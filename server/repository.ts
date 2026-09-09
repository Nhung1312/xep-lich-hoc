import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Group,
  Student,
  StudentAvailabilityDoc,
  TeacherConfig,
  ScheduleSession,
  OptimizationResult,
  ScheduleCombinationOption,
  AvailabilityStatus,
  normalizeSlotKey,
  getSlotLabel,
  getSlotTimeDisplay,
} from '../src/types.ts';
import { getStudentSlotStatus } from './scheduler.ts';
import {
  AppDatabase,
  createDefaultTeacherConfig,
  createInitialSeedData,
} from './db.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'app_data.json');
const TMP_DB_FILE = path.resolve(DATA_DIR, 'app_data.json.tmp');

export interface IDatabaseRepository {
  getState(): AppDatabase;
  saveState(data: AppDatabase): void;
  getGroupByCode(code: string): Group | null;
  getStudentByParentToken(
    code: string,
    token: string
  ): { student: Student; availability: StudentAvailabilityDoc | null } | null;
  upsertParentSubmission(params: {
    groupId: string;
    studentName: string;
    phone: string;
    parentName?: string;
    availabilities: Record<string, AvailabilityStatus>;
    studentId?: string;
    parentToken?: string;
  }): {
    student: Student;
    parentToken: string;
    availability: StudentAvailabilityDoc;
    isNew: boolean;
  };
  isGroupLocked(groupId: string): boolean;
  lockGroup(groupId: string, isLocked: boolean): Group | null;
  confirmGroup(groupId: string): Group | null;
  resetGroup(groupId: string): boolean;
  selectGroupOption(
    groupId: string,
    option: ScheduleCombinationOption
  ): { group: Group; schedules: ScheduleSession[] };
  saveManualSchedules(schedules: ScheduleSession[]): { success: boolean; count: number };
  saveTeacherConfig(config: Partial<TeacherConfig>): TeacherConfig;
  createGroup(groupData: Partial<Group>): Group;
  updateGroup(id: string, groupData: Partial<Group>): Group | null;
  deleteGroup(id: string): boolean;
  createStudent(studentData: Partial<Student>): Student;
  updateStudent(id: string, studentData: Partial<Student>): Student | null;
  deleteStudent(id: string): boolean;
  switchToRealMode(): AppDatabase;
  resetToDemoSeed(): AppDatabase;
}

export class JsonFileDatabaseRepository implements IDatabaseRepository {
  private cache: AppDatabase | null = null;

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public getState(): AppDatabase {
    if (this.cache) {
      return this.cache;
    }

    try {
      this.ensureDataDir();
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed: AppDatabase = JSON.parse(content);
        // Normalize any missing fields
        if (Array.isArray(parsed.groups)) {
          for (const g of parsed.groups) {
            if (!g.status) g.status = g.isLocked ? 'locked' : 'draft';
          }
        }
        if (Array.isArray(parsed.students)) {
          for (const s of parsed.students) {
            if (!s.parentToken) {
              s.parentToken = `pt_${s.id}_${Math.random().toString(36).substring(2, 8)}`;
            }
          }
        }
        this.cache = parsed;
        return this.cache;
      }
    } catch (err) {
      console.warn('Error loading JSON DB, reverting to initial seed:', err);
    }

    this.cache = createInitialSeedData();
    this.saveState(this.cache);
    return this.cache;
  }

  public saveState(data: AppDatabase): void {
    try {
      this.ensureDataDir();
      // Atomic write: write to temp file then rename
      const jsonStr = JSON.stringify(data, null, 2);
      fs.writeFileSync(TMP_DB_FILE, jsonStr, 'utf-8');
      fs.renameSync(TMP_DB_FILE, DB_FILE);
      this.cache = data;
    } catch (err) {
      console.error('Failed to save state to disk:', err);
      // Fallback direct write
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        this.cache = data;
      } catch (innerErr) {
        console.error('Critical fallback save error:', innerErr);
      }
    }
  }

  public getGroupByCode(code: string): Group | null {
    const db = this.getState();
    const cleanCode = code.trim().toUpperCase();
    return db.groups.find((g) => g.code.toUpperCase() === cleanCode) || null;
  }

  public getStudentByParentToken(
    code: string,
    token: string
  ): { student: Student; availability: StudentAvailabilityDoc | null } | null {
    if (!token || !code) return null;
    const db = this.getState();
    const group = this.getGroupByCode(code);
    if (!group) return null;

    const student = db.students.find(
      (s) => s.groupId === group.id && s.parentToken === token.trim()
    );
    if (!student) return null;

    const availability = db.availabilities[student.id] || null;
    return {
      student: {
        id: student.id,
        name: student.name,
        phone: student.phone,
        parentName: student.parentName,
        groupId: student.groupId,
        joinedAt: student.joinedAt,
        hasSubmitted: student.hasSubmitted,
      },
      availability,
    };
  }

  public upsertParentSubmission(params: {
    groupId: string;
    studentName: string;
    phone: string;
    parentName?: string;
    availabilities: Record<string, AvailabilityStatus>;
    studentId?: string;
    parentToken?: string;
  }): {
    student: Student;
    parentToken: string;
    availability: StudentAvailabilityDoc;
    isNew: boolean;
  } {
    const { groupId, studentName, phone, parentName, availabilities, studentId, parentToken } = params;
    const db = this.getState();

    const group = db.groups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error('Nhóm học không tồn tại');
    }

    const cleanName = studentName.trim();
    const cleanPhone = (phone || '').trim();
    const normPhone = cleanPhone.replace(/\D/g, '');
    const cleanParentName = (parentName || '').trim();

    if (!cleanName) {
      throw new Error('Họ và tên học sinh là bắt buộc.');
    }
    if (!cleanPhone || normPhone.length < 9 || normPhone.length > 11) {
      throw new Error('Số điện thoại phụ huynh là bắt buộc và phải là số hợp lệ gồm 10 chữ số.');
    }

    let student: Student | undefined;
    let isNew = false;

    // 1. If parent provided a parentToken, find by token and group
    if (parentToken) {
      student = db.students.find(
        (s) => s.groupId === groupId && s.parentToken === parentToken.trim()
      );
    }

    // 2. If studentId is provided, find by studentId and group
    if (!student && studentId) {
      student = db.students.find((s) => s.groupId === groupId && s.id === studentId);
    }

    // 3. Match by normalized phone in this group
    if (!student && normPhone.length >= 9) {
      student = db.students.find(
        (s) =>
          s.groupId === groupId &&
          s.phone &&
          s.phone.replace(/\D/g, '') === normPhone
      );
    }

    // 4. Match by student name in this group (especially for pre-created students without phone)
    if (!student) {
      student = db.students.find(
        (s) =>
          s.groupId === groupId &&
          s.name.trim().toLowerCase() === cleanName.toLowerCase() &&
          (!s.phone || s.phone.replace(/\D/g, '') === normPhone)
      );
    }

    // Generate a secure parent access token if student doesn't have one
    const generateToken = () =>
      `pt_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;

    if (student) {
      // Update existing student
      student.name = cleanName;
      if (cleanPhone) student.phone = cleanPhone;
      if (cleanParentName) student.parentName = cleanParentName;
      student.hasSubmitted = true;
      if (!student.parentToken) {
        student.parentToken = generateToken();
      }
    } else {
      // Create new student
      isNew = true;
      const newParentToken = generateToken();
      student = {
        id: `stu_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: cleanName,
        phone: cleanPhone,
        parentName: cleanParentName,
        parentToken: newParentToken,
        groupId,
        joinedAt: new Date().toISOString(),
        hasSubmitted: true,
      };
      db.students.push(student);
    }

    // Save student availability
    const availDoc: StudentAvailabilityDoc = {
      studentId: student.id,
      groupId,
      updatedAt: new Date().toISOString(),
      availabilities: availabilities || {},
    };
    db.availabilities[student.id] = availDoc;

    this.saveState(db);

    return {
      student,
      parentToken: student.parentToken || '',
      availability: availDoc,
      isNew,
    };
  }

  public isGroupLocked(groupId: string): boolean {
    const db = this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    return group?.isLocked === true || group?.status === 'locked';
  }

  public lockGroup(groupId: string, isLocked: boolean): Group | null {
    const db = this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) return null;

    group.isLocked = !!isLocked;
    const hasSchedules = db.schedules.some((s) => s.groupId === groupId);
    group.status = isLocked ? 'locked' : (hasSchedules ? 'confirmed' : 'draft');

    for (const s of db.schedules) {
      if (s.groupId === groupId) {
        s.isLocked = !!isLocked;
        s.status = isLocked ? 'locked' : 'confirmed';
      }
    }

    this.saveState(db);
    return group;
  }

  public confirmGroup(groupId: string): Group | null {
    const db = this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) return null;

    if (group.isLocked || group.status === 'locked') {
      throw new Error('Lịch nhóm đã được khóa và không thể thay đổi.');
    }

    const hasSchedules = db.schedules.some((s) => s.groupId === groupId);
    if (!hasSchedules) {
      throw new Error('Nhóm chưa có lịch nào để xác nhận. Vui lòng chọn phương án lịch trước.');
    }

    group.status = 'confirmed';
    for (const s of db.schedules) {
      if (s.groupId === groupId) {
        s.status = 'confirmed';
      }
    }

    this.saveState(db);
    return group;
  }

  public resetGroup(groupId: string): boolean {
    const db = this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) return false;

    if (group.isLocked || group.status === 'locked') {
      throw new Error('Lịch nhóm đã được khóa và không thể thay đổi. Vui lòng mở khóa trước.');
    }

    db.schedules = db.schedules.filter((s) => s.groupId !== groupId);
    group.status = 'draft';
    group.selectedOptionId = undefined;

    this.saveState(db);
    return true;
  }

  public selectGroupOption(
    groupId: string,
    option: ScheduleCombinationOption
  ): { group: Group; schedules: ScheduleSession[] } {
    const db = this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error('Nhóm học không tồn tại');
    }

    // 1. Check locked constraint
    if (group.isLocked || group.status === 'locked') {
      throw new Error('Lịch nhóm đã được khóa và không thể thay đổi.');
    }

    if (!option || !Array.isArray(option.sessions) || option.sessions.length === 0) {
      throw new Error('Phương án lịch không hợp lệ.');
    }

    // 2. Validate option against group & teacher settings
    if (option.sessions.length !== group.sessionsPerWeek) {
      throw new Error(
        `Số buổi của phương án (${option.sessions.length}) không khớp với số buổi quy định của nhóm (${group.sessionsPerWeek} buổi/tuần).`
      );
    }

    const normAllowedSlots = (group.allowedSlots || []).map(normalizeSlotKey);
    const allowedDays = group.allowedDays || ['2', '3', '4', '5', '6', '7'];

    for (const sess of option.sessions) {
      const normSlot = normalizeSlotKey(sess.slot);

      // Check allowedDays
      if (!allowedDays.includes(sess.dayOfWeek)) {
        throw new Error(
          `Thứ ${sess.dayOfWeek} không nằm trong danh sách các ngày được phép xếp lịch cho nhóm ${group.name}.`
        );
      }

      // Check allowedSlots
      if (!normAllowedSlots.includes(normSlot)) {
        throw new Error(
          `Ca ${getSlotLabel(normSlot)} không nằm trong danh sách ca được phép xếp lịch cho nhóm ${group.name}.`
        );
      }

      // Check teacher slot enabled
      const timeInfo = getSlotTimeDisplay(sess.dayOfWeek, normSlot, db.teacherConfig);
      if (!timeInfo.enabled) {
        throw new Error(
          `Ca ${sess.dayOfWeek} ${getSlotLabel(normSlot)} đã bị tắt trong cài đặt thời gian của giáo viên.`
        );
      }

      // Hard constraint: Check teacher conflict with any other group (tentative, confirmed, or locked)
      const conflict = db.schedules.find(
        (s) =>
          s.groupId !== groupId &&
          s.dayOfWeek === sess.dayOfWeek &&
          normalizeSlotKey(s.slot) === normSlot
      );
      if (conflict) {
        const otherGroup = db.groups.find((g) => g.id === conflict.groupId);
        throw new Error(
          `Xung đột lịch giáo viên: Ca ${sess.dayOfWeek} (${sess.startTime}-${sess.endTime}) đang được sử dụng bởi nhóm "${otherGroup?.name || conflict.groupId}".`
        );
      }
    }

    // Check no duplicate slots within the option itself
    const optionSlotKeys = new Set<string>();
    for (const sess of option.sessions) {
      const k = `${sess.dayOfWeek}_${normalizeSlotKey(sess.slot)}`;
      if (optionSlotKeys.has(k)) {
        throw new Error('Phương án chứa các ca học trùng nhau trong tuần.');
      }
      optionSlotKeys.add(k);
    }

    // 3. Re-calculate student eligibility server-side (do NOT blindly trust frontend)
    const groupStudents = db.students.filter((s) => s.groupId === groupId);

    // Map occupied slots of students in OTHER groups
    const occupiedInOtherGroups = new Set<string>(); // `${studentId}_${day}_${slot}`
    for (const existingSess of db.schedules) {
      if (existingSess.groupId !== groupId) {
        for (const sid of existingSess.studentIds) {
          occupiedInOtherGroups.add(
            `${sid}_${existingSess.dayOfWeek}_${normalizeSlotKey(existingSess.slot)}`
          );
        }
      }
    }

    const eligibleStudentIds: string[] = [];
    for (const student of groupStudents) {
      // Must have submitted availability
      const availDoc = db.availabilities[student.id];
      if (!student.hasSubmitted || !availDoc) {
        continue;
      }

      // Must be available for ALL sessions in the option, and not occupied in other groups
      let canAttendAll = true;
      for (const sess of option.sessions) {
        const normSlot = normalizeSlotKey(sess.slot);
        const slotKey = `${student.id}_${sess.dayOfWeek}_${normSlot}`;
        if (occupiedInOtherGroups.has(slotKey)) {
          canAttendAll = false;
          break;
        }

        const status = getStudentSlotStatus(student.id, sess.dayOfWeek, normSlot, db.availabilities);
        if (status !== 'available' && status !== 'preferred') {
          canAttendAll = false;
          break;
        }
      }

      if (canAttendAll) {
        eligibleStudentIds.push(student.id);
      }
    }

    // Max students constraint
    if (eligibleStudentIds.length > group.maxStudents) {
      eligibleStudentIds.splice(group.maxStudents);
    }

    // Remove existing sessions for this group
    db.schedules = db.schedules.filter((s) => s.groupId !== groupId);

    // Create tentative sessions
    for (const sess of option.sessions) {
      const normSlot = normalizeSlotKey(sess.slot);
      const timeInfo = getSlotTimeDisplay(sess.dayOfWeek, normSlot, db.teacherConfig);

      db.schedules.push({
        id: `sess_${groupId}_${sess.dayOfWeek}_${normSlot}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        groupId,
        dayOfWeek: sess.dayOfWeek,
        slot: normSlot,
        startTime: timeInfo.startTime,
        endTime: timeInfo.endTime,
        isLocked: false,
        status: 'tentative',
        studentIds: eligibleStudentIds,
      });
    }

    group.status = 'tentative';
    group.selectedOptionId = option.id;

    this.saveState(db);
    return { group, schedules: db.schedules };
  }

  public saveManualSchedules(schedules: ScheduleSession[]): { success: boolean; count: number } {
    const db = this.getState();

    // Identify all locked groups
    const lockedGroupIds = new Set(
      db.groups.filter((g) => g.isLocked || g.status === 'locked').map((g) => g.id)
    );

    // If there are locked groups, verify that their sessions have NOT been altered or removed
    if (lockedGroupIds.size > 0) {
      const existingLockedSessions = db.schedules.filter((s) => lockedGroupIds.has(s.groupId));

      // Check each locked session exists in incoming schedules
      for (const lockedSess of existingLockedSessions) {
        const found = schedules.find(
          (s) =>
            s.id === lockedSess.id &&
            s.groupId === lockedSess.groupId &&
            s.dayOfWeek === lockedSess.dayOfWeek &&
            normalizeSlotKey(s.slot) === normalizeSlotKey(lockedSess.slot)
        );

        if (!found) {
          throw new Error('Lịch nhóm đã được khóa và không thể thay đổi.');
        }
      }

      // Check that no incoming new/modified session attempts to alter a locked group
      const incomingLockedSessions = schedules.filter((s) => lockedGroupIds.has(s.groupId));
      if (incomingLockedSessions.length !== existingLockedSessions.length) {
        throw new Error('Lịch nhóm đã được khóa và không thể thay đổi.');
      }
    }

    // Hard constraint: Check that no two groups share the exact same teacher slot
    const slotMap = new Map<string, string>(); // slotKey -> groupId
    for (const sess of schedules) {
      const key = `${sess.dayOfWeek}_${normalizeSlotKey(sess.slot)}`;
      const existingGroup = slotMap.get(key);
      if (existingGroup && existingGroup !== sess.groupId) {
        const g1 = db.groups.find((g) => g.id === existingGroup);
        const g2 = db.groups.find((g) => g.id === sess.groupId);
        throw new Error(
          `Xung đột lịch giáo viên: Ca ${sess.dayOfWeek} ${normalizeSlotKey(sess.slot)} bị trùng giữa nhóm "${g1?.name}" và "${g2?.name}". Giáo viên chỉ được dạy 1 nhóm tại 1 thời điểm.`
        );
      }
      slotMap.set(key, sess.groupId);
    }

    // Hard constraint: Check that no student is double booked at the same slot
    const studentSlotMap = new Map<string, string>(); // `${studentId}_${day}_${slot}` -> groupId
    for (const sess of schedules) {
      const slotKey = normalizeSlotKey(sess.slot);
      for (const sid of sess.studentIds) {
        const studentSlotKey = `${sid}_${sess.dayOfWeek}_${slotKey}`;
        const conflictGroup = studentSlotMap.get(studentSlotKey);
        if (conflictGroup && conflictGroup !== sess.groupId) {
          const student = db.students.find((s) => s.id === sid);
          const g1 = db.groups.find((g) => g.id === conflictGroup);
          const g2 = db.groups.find((g) => g.id === sess.groupId);
          throw new Error(
            `Xung đột lịch học sinh: Học sinh "${student?.name || sid}" bị xếp trùng lịch vào ca ${sess.dayOfWeek} giữa nhóm "${g1?.name}" và "${g2?.name}".`
          );
        }
        studentSlotMap.set(studentSlotKey, sess.groupId);
      }
    }

    // Verify group constraints and slot enabled
    for (const sess of schedules) {
      const grp = db.groups.find((g) => g.id === sess.groupId);
      if (grp) {
        const normSlot = normalizeSlotKey(sess.slot);
        const allowedSlots = (grp.allowedSlots || []).map(normalizeSlotKey);
        if (!allowedSlots.includes(normSlot)) {
          throw new Error(`Ca ${getSlotLabel(normSlot)} không nằm trong danh sách ca cho phép của nhóm "${grp.name}".`);
        }
        if (grp.allowedDays && !grp.allowedDays.includes(sess.dayOfWeek)) {
          throw new Error(`Thứ ${sess.dayOfWeek} không nằm trong danh sách ngày cho phép của nhóm "${grp.name}".`);
        }
        if (sess.studentIds.length > grp.maxStudents) {
          throw new Error(`Số lượng học sinh (${sess.studentIds.length}) vượt quá sĩ số tối đa (${grp.maxStudents}) của nhóm "${grp.name}".`);
        }
      }
    }

    db.schedules = schedules;
    this.saveState(db);
    return { success: true, count: db.schedules.length };
  }

  public saveTeacherConfig(config: Partial<TeacherConfig>): TeacherConfig {
    const db = this.getState();
    db.teacherConfig = {
      ...db.teacherConfig,
      ...config,
    };
    this.saveState(db);
    return db.teacherConfig;
  }

  public createGroup(groupData: Partial<Group>): Group {
    const db = this.getState();
    const codeBase = (groupData.name || 'GROUP')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 5) || 'GROUP';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const code = groupData.code?.trim().toUpperCase() || `${codeBase}${randomSuffix}`;

    const newGroup: Group = {
      id: `grp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      code,
      name: groupData.name || 'Nhóm học mới',
      subject: groupData.subject || 'Toán',
      grade: groupData.grade || 'Khối 8',
      maxStudents: Number(groupData.maxStudents) || 8,
      sessionsPerWeek: Number(groupData.sessionsPerWeek) || 2,
      durationMinutes: Number(groupData.durationMinutes) || 90,
      allowedDays: groupData.allowedDays || ['2', '3', '4', '5', '6', '7'],
      allowedSlots: groupData.allowedSlots || ['c1', 'c2', 'c3', 'c4', 'ct'],
      teacherId: db.teacherConfig.teacherId,
      isLocked: false,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    db.groups.push(newGroup);
    this.saveState(db);
    return newGroup;
  }

  public updateGroup(id: string, groupData: Partial<Group>): Group | null {
    const db = this.getState();
    const idx = db.groups.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    db.groups[idx] = {
      ...db.groups[idx],
      ...groupData,
      id,
    };

    this.saveState(db);
    return db.groups[idx];
  }

  public deleteGroup(id: string): boolean {
    const db = this.getState();
    const grp = db.groups.find((g) => g.id === id);
    if (!grp) return false;

    if (grp.isLocked) {
      throw new Error('Nhóm đã được khóa, không thể xóa. Vui lòng mở khóa trước khi xóa.');
    }

    db.groups = db.groups.filter((g) => g.id !== id);
    const studentIdsToRemove = new Set(
      db.students.filter((s) => s.groupId === id).map((s) => s.id)
    );
    db.students = db.students.filter((s) => s.groupId !== id);
    db.schedules = db.schedules.filter((s) => s.groupId !== id);

    for (const sid of studentIdsToRemove) {
      delete db.availabilities[sid];
    }

    this.saveState(db);
    return true;
  }

  public createStudent(studentData: Partial<Student>): Student {
    const db = this.getState();
    const newStudent: Student = {
      id: `stu_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: (studentData.name || '').trim(),
      phone: (studentData.phone || '').trim(),
      parentName: (studentData.parentName || '').trim(),
      parentToken: `pt_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`,
      groupId: studentData.groupId || '',
      joinedAt: new Date().toISOString(),
      hasSubmitted: !!studentData.hasSubmitted,
    };

    db.students.push(newStudent);
    this.saveState(db);
    return newStudent;
  }

  public updateStudent(id: string, studentData: Partial<Student>): Student | null {
    const db = this.getState();
    const idx = db.students.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    db.students[idx] = {
      ...db.students[idx],
      ...studentData,
      id,
    };

    this.saveState(db);
    return db.students[idx];
  }

  public deleteStudent(id: string): boolean {
    const db = this.getState();
    const student = db.students.find((s) => s.id === id);
    if (!student) return false;

    db.students = db.students.filter((s) => s.id !== id);
    delete db.availabilities[id];

    for (const session of db.schedules) {
      session.studentIds = session.studentIds.filter((sid) => sid !== id);
    }

    this.saveState(db);
    return true;
  }

  public switchToRealMode(): AppDatabase {
    const db = this.getState();
    const freshTeacher = db.teacherConfig || createDefaultTeacherConfig();
    const realDb: AppDatabase = {
      teacherConfig: freshTeacher,
      groups: [],
      students: [],
      availabilities: {},
      schedules: [],
      lastOptimizationResult: null,
      isRealDataMode: true,
    };
    this.saveState(realDb);
    return realDb;
  }

  public resetToDemoSeed(): AppDatabase {
    const fresh = createInitialSeedData();
    fresh.isRealDataMode = false;
    this.saveState(fresh);
    return fresh;
  }
}

// Global repository singleton
export const dbRepository: IDatabaseRepository = new JsonFileDatabaseRepository();
