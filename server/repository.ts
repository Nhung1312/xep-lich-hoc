import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import type {
  Group,
  Student,
  StudentAvailabilityDoc,
  TeacherConfig,
  ScheduleSession,
  ScheduleCombinationOption,
  AvailabilityStatus,
} from '../src/types.ts';
import {
  normalizeSlotKey,
  getSlotLabel,
  getSlotTimeDisplay,
} from '../src/types.ts';
import { getStudentSlotStatus } from './scheduler.ts';
import type { AppDatabase } from './db.ts';
import {
  createDefaultTeacherConfig,
  createInitialSeedData,
} from './db.ts';

const { Pool } = pg;

// Local file storage locations
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'app_data.json');
const TMP_DB_FILE = path.resolve('/tmp', 'app_data.json');

export interface IDatabaseRepository {
  getState(): Promise<AppDatabase>;
  saveState(data: AppDatabase): Promise<void>;
  getGroupByCode(code: string): Promise<Group | null>;
  getStudentByParentToken(
    code: string,
    token: string
  ): Promise<{ student: Student; availability: StudentAvailabilityDoc | null } | null>;
  upsertParentSubmission(params: {
    groupId: string;
    studentName: string;
    phone: string;
    parentName?: string;
    availabilities: Record<string, AvailabilityStatus>;
    studentId?: string;
    parentToken?: string;
  }): Promise<{
    student: Student;
    parentToken: string;
    availability: StudentAvailabilityDoc;
    isNew: boolean;
  }>;
  isGroupLocked(groupId: string): Promise<boolean>;
  lockGroup(groupId: string, isLocked: boolean): Promise<Group | null>;
  confirmGroup(groupId: string): Promise<Group | null>;
  resetGroup(groupId: string): Promise<boolean>;
  selectGroupOption(
    groupId: string,
    option: ScheduleCombinationOption
  ): Promise<{ group: Group; schedules: ScheduleSession[] }>;
  saveManualSchedules(schedules: ScheduleSession[]): Promise<{ success: boolean; count: number }>;
  saveTeacherConfig(config: Partial<TeacherConfig>): Promise<TeacherConfig>;
  createGroup(groupData: Partial<Group>): Promise<Group>;
  updateGroup(id: string, groupData: Partial<Group>): Promise<Group | null>;
  deleteGroup(id: string): Promise<boolean>;
  createStudent(studentData: Partial<Student>): Promise<Student>;
  updateStudent(id: string, studentData: Partial<Student>): Promise<Student | null>;
  deleteStudent(id: string): Promise<boolean>;
  switchToRealMode(): Promise<AppDatabase>;
  resetToDemoSeed(): Promise<AppDatabase>;
  getDatabaseType(): 'postgresql' | 'local_file';
}

export class PostgresAndFileDatabaseRepository implements IDatabaseRepository {
  private cache: AppDatabase | null = null;
  private pgPool: pg.Pool | null = null;
  private isTableInitialized = false;

  constructor() {
    this.initPool();
  }

  private getConnectionString(): string | null {
    const raw = (
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      ''
    ).trim();

    if (!raw) return null;
    // Strip wrapping quotes if user pasted connection string with quotes
    const unquoted = raw.replace(/^["']|["']$/g, '').trim();
    return unquoted || null;
  }

  public getDatabaseType(): 'postgresql' | 'local_file' {
    return this.getConnectionString() ? 'postgresql' : 'local_file';
  }

  private initPool(): void {
    const connStr = this.getConnectionString();
    if (!connStr) {
      return;
    }

    try {
      const isLocalhost = connStr.includes('localhost') || connStr.includes('127.0.0.1');
      this.pgPool = new Pool({
        connectionString: connStr,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      });

      this.pgPool.on('error', (err) => {
        console.warn('PostgreSQL Pool background warning:', err.message);
      });
    } catch (err) {
      console.warn('Failed to initialize PostgreSQL pool, falling back to local storage:', err);
      this.pgPool = null;
    }
  }

  private async ensurePostgresTable(): Promise<boolean> {
    if (!this.pgPool) return false;
    if (this.isTableInitialized) return true;

    try {
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS teacher_scheduler_state (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      this.isTableInitialized = true;
      return true;
    } catch (err) {
      console.warn('Could not initialize PostgreSQL table:', err);
      return false;
    }
  }

  private ensureLocalDir(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {
      // Ignored for read-only filesystem environments like Vercel
    }
  }

  private readFromLocalFile(): AppDatabase | null {
    try {
      // Try local DATA_DIR first
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(content);
      }
      // Try /tmp fallback
      if (fs.existsSync(TMP_DB_FILE)) {
        const content = fs.readFileSync(TMP_DB_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn('Error reading local file DB:', err);
    }
    return null;
  }

  private writeToLocalFile(data: AppDatabase): void {
    const jsonStr = JSON.stringify(data, null, 2);
    // 1. Try standard DB_FILE
    try {
      this.ensureLocalDir();
      fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');
      return;
    } catch {
      // If read-only filesystem, try /tmp
    }

    try {
      fs.writeFileSync(TMP_DB_FILE, jsonStr, 'utf-8');
    } catch (err) {
      console.warn('Could not write to local file or /tmp:', err);
    }
  }

  private normalizeData(data: unknown): AppDatabase {
    let parsed: any = data;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = {};
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      parsed = {};
    }
    if (!Array.isArray(parsed.groups)) {
      parsed.groups = [];
    } else {
      for (const g of parsed.groups) {
        if (!g.status) g.status = g.isLocked ? 'locked' : 'draft';
      }
    }
    if (!Array.isArray(parsed.students)) {
      parsed.students = [];
    } else {
      for (const s of parsed.students) {
        if (!s.parentToken) {
          s.parentToken = `pt_${s.id}_${Math.random().toString(36).substring(2, 8)}`;
        }
      }
    }
    if (!parsed.availabilities || typeof parsed.availabilities !== 'object') {
      parsed.availabilities = {};
    }
    if (!Array.isArray(parsed.schedules)) {
      parsed.schedules = [];
    }
    if (!parsed.teacherConfig || typeof parsed.teacherConfig !== 'object') {
      parsed.teacherConfig = createDefaultTeacherConfig();
    }
    return parsed as AppDatabase;
  }

  public async getState(): Promise<AppDatabase> {
    // 1. If PostgreSQL pool is available, try to fetch from DB
    if (this.pgPool) {
      try {
        const tableReady = await this.ensurePostgresTable();
        if (tableReady) {
          const res = await this.pgPool.query(
            `SELECT data FROM teacher_scheduler_state WHERE id = 'main_state' LIMIT 1;`
          );
          if (res.rows.length > 0 && res.rows[0].data) {
            const data = this.normalizeData(res.rows[0].data);
            this.cache = data;
            return data;
          } else {
            // Seed DB if table is empty
            const initial = createInitialSeedData();
            await this.saveState(initial);
            this.cache = initial;
            return initial;
          }
        }
      } catch (err) {
        console.warn('PostgreSQL fetch error, falling back to cache/file:', err);
      }
    }

    // 2. Cache fallback
    if (this.cache) {
      return this.cache;
    }

    // 3. Local file fallback
    const fromFile = this.readFromLocalFile();
    if (fromFile) {
      this.cache = this.normalizeData(fromFile);
      return this.cache;
    }

    // 4. Seed fallback
    this.cache = createInitialSeedData();
    this.writeToLocalFile(this.cache);
    return this.cache;
  }

  public async saveState(data: AppDatabase): Promise<void> {
    this.cache = data;

    // 1. Save to PostgreSQL if pool exists
    if (this.pgPool) {
      try {
        const tableReady = await this.ensurePostgresTable();
        if (tableReady) {
          await this.pgPool.query(
            `INSERT INTO teacher_scheduler_state (id, data, updated_at)
             VALUES ('main_state', $1, NOW())
             ON CONFLICT (id) DO UPDATE
             SET data = $1, updated_at = NOW();`,
            [JSON.stringify(data)]
          );
          return;
        }
      } catch (err) {
        console.error('PostgreSQL save error:', err);
      }
    }

    // 2. Fallback to local file
    this.writeToLocalFile(data);
  }

  public async getGroupByCode(code: string): Promise<Group | null> {
    const db = await this.getState();
    const cleanCode = code.trim().toUpperCase();
    return db.groups.find((g) => g.code.toUpperCase() === cleanCode) || null;
  }

  public async getStudentByParentToken(
    code: string,
    token: string
  ): Promise<{ student: Student; availability: StudentAvailabilityDoc | null } | null> {
    if (!token || !code) return null;
    const db = await this.getState();
    const group = await this.getGroupByCode(code);
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

  public async upsertParentSubmission(params: {
    groupId: string;
    studentName: string;
    phone: string;
    parentName?: string;
    availabilities: Record<string, AvailabilityStatus>;
    studentId?: string;
    parentToken?: string;
  }): Promise<{
    student: Student;
    parentToken: string;
    availability: StudentAvailabilityDoc;
    isNew: boolean;
  }> {
    const { groupId, studentName, phone, parentName, availabilities, studentId, parentToken } = params;
    const db = await this.getState();

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

    // 4. Match by student name in this group
    if (!student) {
      student = db.students.find(
        (s) =>
          s.groupId === groupId &&
          s.name.trim().toLowerCase() === cleanName.toLowerCase() &&
          (!s.phone || s.phone.replace(/\D/g, '') === normPhone)
      );
    }

    const generateToken = () =>
      `pt_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;

    if (student) {
      student.name = cleanName;
      if (cleanPhone) student.phone = cleanPhone;
      if (cleanParentName) student.parentName = cleanParentName;
      student.hasSubmitted = true;
      if (!student.parentToken) {
        student.parentToken = generateToken();
      }
    } else {
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

    const availDoc: StudentAvailabilityDoc = {
      studentId: student.id,
      groupId,
      updatedAt: new Date().toISOString(),
      availabilities: availabilities || {},
    };
    db.availabilities[student.id] = availDoc;

    await this.saveState(db);

    return {
      student,
      parentToken: student.parentToken || '',
      availability: availDoc,
      isNew,
    };
  }

  public async isGroupLocked(groupId: string): Promise<boolean> {
    const db = await this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    return group?.isLocked === true || group?.status === 'locked';
  }

  public async lockGroup(groupId: string, isLocked: boolean): Promise<Group | null> {
    const db = await this.getState();
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

    await this.saveState(db);
    return group;
  }

  public async confirmGroup(groupId: string): Promise<Group | null> {
    const db = await this.getState();
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

    await this.saveState(db);
    return group;
  }

  public async resetGroup(groupId: string): Promise<boolean> {
    const db = await this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) return false;

    if (group.isLocked || group.status === 'locked') {
      throw new Error('Lịch nhóm đã được khóa và không thể thay đổi. Vui lòng mở khóa trước.');
    }

    db.schedules = db.schedules.filter((s) => s.groupId !== groupId);
    group.status = 'draft';
    group.selectedOptionId = undefined;

    await this.saveState(db);
    return true;
  }

  public async selectGroupOption(
    groupId: string,
    option: ScheduleCombinationOption
  ): Promise<{ group: Group; schedules: ScheduleSession[] }> {
    const db = await this.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error('Nhóm học không tồn tại');
    }

    if (group.isLocked || group.status === 'locked') {
      throw new Error('Lịch nhóm đã được khóa và không thể thay đổi.');
    }

    if (!option || !Array.isArray(option.sessions) || option.sessions.length === 0) {
      throw new Error('Phương án lịch không hợp lệ.');
    }

    if (option.sessions.length !== group.sessionsPerWeek) {
      throw new Error(
        `Số buổi của phương án (${option.sessions.length}) không khớp với số buổi quy định của nhóm (${group.sessionsPerWeek} buổi/tuần).`
      );
    }

    const normAllowedSlots = (group.allowedSlots || []).map(normalizeSlotKey);
    const allowedDays = group.allowedDays || ['2', '3', '4', '5', '6', '7'];

    for (const sess of option.sessions) {
      const normSlot = normalizeSlotKey(sess.slot);

      if (!allowedDays.includes(sess.dayOfWeek)) {
        throw new Error(
          `Thứ ${sess.dayOfWeek} không nằm trong danh sách các ngày được phép xếp lịch cho nhóm ${group.name}.`
        );
      }

      if (!normAllowedSlots.includes(normSlot)) {
        throw new Error(
          `Ca ${getSlotLabel(normSlot)} không nằm trong danh sách ca được phép xếp lịch cho nhóm ${group.name}.`
        );
      }

      const timeInfo = getSlotTimeDisplay(sess.dayOfWeek, normSlot, db.teacherConfig);
      if (!timeInfo.enabled) {
        throw new Error(
          `Ca ${sess.dayOfWeek} ${getSlotLabel(normSlot)} đã bị tắt trong cài đặt thời gian của giáo viên.`
        );
      }

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

    const optionSlotKeys = new Set<string>();
    for (const sess of option.sessions) {
      const k = `${sess.dayOfWeek}_${normalizeSlotKey(sess.slot)}`;
      if (optionSlotKeys.has(k)) {
        throw new Error('Phương án chứa các ca học trùng nhau trong tuần.');
      }
      optionSlotKeys.add(k);
    }

    const groupStudents = db.students.filter((s) => s.groupId === groupId);

    const occupiedInOtherGroups = new Set<string>();
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
      const availDoc = db.availabilities[student.id];
      if (!student.hasSubmitted || !availDoc) {
        continue;
      }

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

    if (eligibleStudentIds.length > group.maxStudents) {
      eligibleStudentIds.splice(group.maxStudents);
    }

    db.schedules = db.schedules.filter((s) => s.groupId !== groupId);

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

    await this.saveState(db);
    return { group, schedules: db.schedules };
  }

  public async saveManualSchedules(schedules: ScheduleSession[]): Promise<{ success: boolean; count: number }> {
    const db = await this.getState();

    const lockedGroupIds = new Set(
      db.groups.filter((g) => g.isLocked || g.status === 'locked').map((g) => g.id)
    );

    if (lockedGroupIds.size > 0) {
      const existingLockedSessions = db.schedules.filter((s) => lockedGroupIds.has(s.groupId));

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

      const incomingLockedSessions = schedules.filter((s) => lockedGroupIds.has(s.groupId));
      if (incomingLockedSessions.length !== existingLockedSessions.length) {
        throw new Error('Lịch nhóm đã được khóa và không thể thay đổi.');
      }
    }

    const slotMap = new Map<string, string>();
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

    const studentSlotMap = new Map<string, string>();
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
    await this.saveState(db);
    return { success: true, count: db.schedules.length };
  }

  public async saveTeacherConfig(config: Partial<TeacherConfig>): Promise<TeacherConfig> {
    const db = await this.getState();
    db.teacherConfig = {
      ...db.teacherConfig,
      ...config,
    };
    await this.saveState(db);
    return db.teacherConfig;
  }

  public async createGroup(groupData: Partial<Group>): Promise<Group> {
    const db = await this.getState();
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
    await this.saveState(db);
    return newGroup;
  }

  public async updateGroup(id: string, groupData: Partial<Group>): Promise<Group | null> {
    const db = await this.getState();
    const idx = db.groups.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    db.groups[idx] = {
      ...db.groups[idx],
      ...groupData,
      id,
    };

    await this.saveState(db);
    return db.groups[idx];
  }

  public async deleteGroup(id: string): Promise<boolean> {
    const db = await this.getState();
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

    await this.saveState(db);
    return true;
  }

  public async createStudent(studentData: Partial<Student>): Promise<Student> {
    const db = await this.getState();
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
    await this.saveState(db);
    return newStudent;
  }

  public async updateStudent(id: string, studentData: Partial<Student>): Promise<Student | null> {
    const db = await this.getState();
    const idx = db.students.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    db.students[idx] = {
      ...db.students[idx],
      ...studentData,
      id,
    };

    await this.saveState(db);
    return db.students[idx];
  }

  public async deleteStudent(id: string): Promise<boolean> {
    const db = await this.getState();
    const student = db.students.find((s) => s.id === id);
    if (!student) return false;

    db.students = db.students.filter((s) => s.id !== id);
    delete db.availabilities[id];

    for (const session of db.schedules) {
      session.studentIds = session.studentIds.filter((sid) => sid !== id);
    }

    await this.saveState(db);
    return true;
  }

  public async switchToRealMode(): Promise<AppDatabase> {
    const db = await this.getState();
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
    await this.saveState(realDb);
    return realDb;
  }

  public async resetToDemoSeed(): Promise<AppDatabase> {
    const fresh = createInitialSeedData();
    fresh.isRealDataMode = false;
    await this.saveState(fresh);
    return fresh;
  }
}

// Global repository singleton
export const dbRepository: IDatabaseRepository = new PostgresAndFileDatabaseRepository();
