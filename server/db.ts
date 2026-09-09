import fs from 'fs';
import path from 'path';
import {
  Group,
  Student,
  StudentAvailabilityDoc,
  TeacherConfig,
  ScheduleSession,
  OptimizationResult,
  DAYS_CONFIG,
  SLOTS_CONFIG,
  normalizeSlotKey,
} from '../src/types.ts';

export interface AppDatabase {
  teacherConfig: TeacherConfig;
  groups: Group[];
  students: Student[];
  availabilities: Record<string, StudentAvailabilityDoc>;
  schedules: ScheduleSession[];
  lastOptimizationResult: OptimizationResult | null;
  isRealDataMode?: boolean;
}

export const AppDatabase = undefined;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'app_data.json');

export function createDefaultTeacherConfig(): TeacherConfig {
  const slotTimes: Record<string, { startTime: string; endTime: string; enabled: boolean; customName?: string }> = {};

  const defaultSlotTimes: Record<'c1' | 'c2' | 'c3' | 'c4' | 'ct', { startTime: string; endTime: string; enabled: boolean }> = {
    c1: { startTime: '07:30', endTime: '09:00', enabled: true },
    c2: { startTime: '09:15', endTime: '10:45', enabled: true },
    c3: { startTime: '14:00', endTime: '15:30', enabled: true },
    c4: { startTime: '15:45', endTime: '17:15', enabled: true },
    ct: { startTime: '19:00', endTime: '20:30', enabled: true },
  };

  for (const day of DAYS_CONFIG) {
    for (const slot of SLOTS_CONFIG) {
      const key = `${day.key}_${slot.id}`;
      const isWeekend = day.key === '7' || day.key === 'CN';
      // Teacher enabled on afternoons/evenings on weekdays and all day weekends
      const enabled = isWeekend ? true : slot.id === 'c3' || slot.id === 'c4' || slot.id === 'ct';

      slotTimes[key] = {
        startTime: slot.defaultStartTime,
        endTime: slot.defaultEndTime,
        enabled,
      };

      // Also set legacy alias if any
      if (slot.legacyAlias) {
        slotTimes[`${day.key}_${slot.legacyAlias}`] = {
          startTime: slot.defaultStartTime,
          endTime: slot.defaultEndTime,
          enabled,
        };
      }
    }
  }

  return {
    teacherId: 'teacher_1',
    teacherName: 'Thầy Nguyễn Văn Nam',
    phone: '0912 345 678',
    defaultSlotTimes,
    slotTimes,
  };
}

export function createInitialSeedData(): AppDatabase {
  const teacherConfig = createDefaultTeacherConfig();

  const groups: Group[] = [
    {
      id: 'grp_toan8a',
      code: 'TOAN8A26',
      name: 'Toán 8A - Nâng Cao',
      subject: 'Toán',
      grade: 'Khối 8',
      maxStudents: 8,
      sessionsPerWeek: 2,
      durationMinutes: 90,
      allowedDays: ['2', '3', '4', '5', '6', '7'],
      allowedSlots: ['c3', 'c4', 'ct'],
      teacherId: 'teacher_1',
      isLocked: false,
      status: 'draft',
      createdAt: '2026-09-01T08:00:00.000Z',
    },
    {
      id: 'grp_toan9onthi',
      code: 'TOAN9VIP',
      name: 'Toán 9 - Luyện Thi Vào 10',
      subject: 'Toán',
      grade: 'Khối 9',
      maxStudents: 6,
      sessionsPerWeek: 2,
      durationMinutes: 90,
      allowedDays: ['2', '3', '4', '5', '6', '7', 'CN'],
      allowedSlots: ['c1', 'c2', 'c3', 'c4', 'ct'],
      teacherId: 'teacher_1',
      isLocked: false,
      status: 'draft',
      createdAt: '2026-09-02T08:00:00.000Z',
    },
    {
      id: 'grp_hinh8b',
      code: 'HINH8B01',
      name: 'Hình Học 8 Chuyên Sâu',
      subject: 'Hình Học',
      grade: 'Khối 8',
      maxStudents: 6,
      sessionsPerWeek: 1,
      durationMinutes: 90,
      allowedDays: ['3', '5', '7'],
      allowedSlots: ['c4', 'ct'],
      teacherId: 'teacher_1',
      isLocked: false,
      status: 'draft',
      createdAt: '2026-09-03T08:00:00.000Z',
    },
  ];

  const students: Student[] = [
    // Group Toán 8A (5 students submitted, 1 pending)
    {
      id: 'stu_1',
      name: 'Nguyễn Hoàng Minh',
      phone: '0981 112 233',
      parentName: 'Bác Minh',
      groupId: 'grp_toan8a',
      joinedAt: '2026-09-03T09:00:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_2',
      name: 'Trần Thảo Linh',
      phone: '0982 223 344',
      parentName: 'Cô Linh',
      groupId: 'grp_toan8a',
      joinedAt: '2026-09-03T09:30:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_3',
      name: 'Lê Bảo Nam',
      phone: '0983 334 455',
      parentName: 'Chú Nam',
      groupId: 'grp_toan8a',
      joinedAt: '2026-09-03T10:00:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_4',
      name: 'Phạm Quỳnh Anh',
      phone: '0984 445 566',
      parentName: 'Chị Quỳnh',
      groupId: 'grp_toan8a',
      joinedAt: '2026-09-04T08:00:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_5',
      name: 'Đặng Tuấn Khang',
      phone: '0985 556 677',
      parentName: 'Anh Khang',
      groupId: 'grp_toan8a',
      joinedAt: '2026-09-04T10:15:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_6',
      name: 'Vũ Ngọc Hân',
      phone: '0986 667 788',
      parentName: 'Cô Hân',
      groupId: 'grp_toan8a',
      joinedAt: '2026-09-05T11:00:00.000Z',
      hasSubmitted: false, // chưa gửi lịch
    },
    // Group Toán 9
    {
      id: 'stu_7',
      name: 'Bùi Đức Anh',
      phone: '0987 778 899',
      parentName: 'Bác Đức',
      groupId: 'grp_toan9onthi',
      joinedAt: '2026-09-05T14:00:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_8',
      name: 'Hoàng Mai Phương',
      phone: '0988 889 900',
      parentName: 'Cô Mai',
      groupId: 'grp_toan9onthi',
      joinedAt: '2026-09-06T09:00:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_9',
      name: 'Ngô Gia Huy',
      phone: '0989 990 011',
      parentName: 'Chú Huy',
      groupId: 'grp_toan9onthi',
      joinedAt: '2026-09-06T10:00:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_10',
      name: 'Đỗ Hà My',
      phone: '0971 112 233',
      parentName: 'Chị My',
      groupId: 'grp_toan9onthi',
      joinedAt: '2026-09-06T11:30:00.000Z',
      hasSubmitted: true,
    },
    // Group Hình học 8B
    {
      id: 'stu_11',
      name: 'Phan Quốc Bảo',
      phone: '0972 223 344',
      parentName: 'Bác Bảo',
      groupId: 'grp_hinh8b',
      joinedAt: '2026-09-07T08:00:00.000Z',
      hasSubmitted: true,
    },
    {
      id: 'stu_12',
      name: 'Lê Khánh Vy',
      phone: '0973 334 455',
      parentName: 'Cô Vy',
      groupId: 'grp_hinh8b',
      joinedAt: '2026-09-07T09:00:00.000Z',
      hasSubmitted: true,
    },
  ];

  const availabilities: Record<string, StudentAvailabilityDoc> = {};

  const makeAvail = (
    studentId: string,
    groupId: string,
    prefs: string[],
    avails: string[]
  ): StudentAvailabilityDoc => {
    const map: Record<string, 'available' | 'preferred' | 'unavailable'> = {};
    for (const key of prefs) {
      map[key] = 'preferred';
      // support legacy alias
      const [d, s] = key.split('_');
      const norm = normalizeSlotKey(s);
      map[`${d}_${norm}`] = 'preferred';
    }
    for (const key of avails) {
      if (!map[key]) map[key] = 'available';
      const [d, s] = key.split('_');
      const norm = normalizeSlotKey(s);
      if (!map[`${d}_${norm}`]) map[`${d}_${norm}`] = 'available';
    }
    return {
      studentId,
      groupId,
      updatedAt: new Date().toISOString(),
      availabilities: map,
    };
  };

  // Group 8A: overlap on T3 tối ('3_ct'), T5 tối ('5_ct'), T2 tối ('2_ct'), T4 tối ('4_ct')
  availabilities['stu_1'] = makeAvail('stu_1', 'grp_toan8a', ['3_ct', '5_ct'], ['2_ct', '4_ct', '7_c4']);
  availabilities['stu_2'] = makeAvail('stu_2', 'grp_toan8a', ['3_ct', '5_ct'], ['2_ct', '6_ct']);
  availabilities['stu_3'] = makeAvail('stu_3', 'grp_toan8a', ['3_ct', '5_ct'], ['4_ct', '7_c4']);
  availabilities['stu_4'] = makeAvail('stu_4', 'grp_toan8a', ['3_ct', '5_ct'], ['2_ct', '7_c2']);
  availabilities['stu_5'] = makeAvail('stu_5', 'grp_toan8a', ['3_ct', '5_ct'], ['7_c4']);

  // Group 9: prefer T4 tối ('4_ct'), T6 tối ('6_ct'), T7 ca 2 ('7_c2'), CN ca 1 ('CN_c1')
  availabilities['stu_7'] = makeAvail('stu_7', 'grp_toan9onthi', ['4_ct', '6_ct'], ['7_c2', 'CN_c1']);
  availabilities['stu_8'] = makeAvail('stu_8', 'grp_toan9onthi', ['4_ct', '6_ct'], ['7_c1', '7_c2']);
  availabilities['stu_9'] = makeAvail('stu_9', 'grp_toan9onthi', ['4_ct', '7_c2'], ['6_ct', 'CN_c1']);
  availabilities['stu_10'] = makeAvail('stu_10', 'grp_toan9onthi', ['6_ct', '7_c2'], ['4_ct', 'CN_c3']);

  // Group Hình học 8B: T7 ca 4 ('7_c4'), T5 ca tối ('5_ct')
  availabilities['stu_11'] = makeAvail('stu_11', 'grp_hinh8b', ['7_c4', '5_ct'], ['3_c4']);
  availabilities['stu_12'] = makeAvail('stu_12', 'grp_hinh8b', ['7_c4'], ['5_ct', '3_ct']);

  return {
    teacherConfig,
    groups,
    students,
    availabilities,
    schedules: [],
    lastOptimizationResult: null,
  };
}

let dbInstance: AppDatabase | null = null;

export function getDatabase(): AppDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbInstance = JSON.parse(content);
      // Migrate old data if necessary
      if (dbInstance && Array.isArray(dbInstance.groups)) {
        for (const g of dbInstance.groups) {
          if (!g.status) g.status = g.isLocked ? 'locked' : 'draft';
        }
      }
      return dbInstance!;
    }
  } catch (err) {
    console.warn('Error reading database file, resetting to initial seed:', err);
  }

  dbInstance = createInitialSeedData();
  saveDatabase(dbInstance);
  return dbInstance;
}

export function saveDatabase(data: AppDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    dbInstance = data;
  } catch (err) {
    console.error('Failed to save database file:', err);
  }
}

export function resetDatabase(): AppDatabase {
  const fresh = createInitialSeedData();
  saveDatabase(fresh);
  return fresh;
}
