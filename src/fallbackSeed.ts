import {
  DAYS_CONFIG,
  SLOTS_CONFIG,
  TeacherConfig,
  Group,
  Student,
  StudentAvailabilityDoc,
  ScheduleSession,
  AppState,
  AvailabilityStatus,
} from './types';

export function createDefaultClientTeacherConfig(): TeacherConfig {
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
      const enabled = isWeekend ? true : slot.id === 'c3' || slot.id === 'c4' || slot.id === 'ct';

      slotTimes[key] = {
        startTime: slot.defaultStartTime,
        endTime: slot.defaultEndTime,
        enabled,
      };

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
    teacherName: 'Thầy Nguyễn Văn A',
    phone: '0912.345.678',
    defaultSlotTimes,
    slotTimes,
  };
}

export function getClientFallbackSeedData(): AppState {
  const teacherConfig = createDefaultClientTeacherConfig();

  const groups: Group[] = [
    {
      id: 'grp_toan8a',
      code: 'TOAN8A26',
      name: 'Toán 8 Nâng Cao - Lớp A',
      subject: 'Toán',
      grade: 'Khối 8',
      maxStudents: 8,
      sessionsPerWeek: 2,
      durationMinutes: 90,
      allowedDays: ['2', '4', '6', '7'],
      allowedSlots: ['c3', 'c4', 'ct'],
      teacherId: 'teacher_1',
      isLocked: false,
      status: 'tentative',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    {
      id: 'grp_toan9pro',
      code: 'TOAN9P26',
      name: 'Toán 9 Luyện Thi Vào 10 Chuyên',
      subject: 'Toán',
      grade: 'Khối 9',
      maxStudents: 6,
      sessionsPerWeek: 2,
      durationMinutes: 90,
      allowedDays: ['3', '5', '7', 'CN'],
      allowedSlots: ['c3', 'c4', 'ct'],
      teacherId: 'teacher_1',
      isLocked: false,
      status: 'draft',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    {
      id: 'grp_ly8b',
      code: 'LY8B26',
      name: 'Vật Lý 8 Cơ Bản & Nâng Cao',
      subject: 'Vật Lý',
      grade: 'Khối 8',
      maxStudents: 8,
      sessionsPerWeek: 1,
      durationMinutes: 90,
      allowedDays: ['2', '3', '5', '7'],
      allowedSlots: ['c1', 'c2', 'c3', 'c4'],
      teacherId: 'teacher_1',
      isLocked: false,
      status: 'draft',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  ];

  const students: Student[] = [
    { id: 'std_1', name: 'Nguyễn Minh Quân', parentName: 'Chị Mai', phone: '0981.111.222', groupId: 'grp_toan8a', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: true },
    { id: 'std_2', name: 'Trần Bảo Ngọc', parentName: 'Anh Dũng', phone: '0982.222.333', groupId: 'grp_toan8a', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: true },
    { id: 'std_3', name: 'Lê Gia Huy', parentName: 'Chị Lan', phone: '0983.333.444', groupId: 'grp_toan8a', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: true },
    { id: 'std_4', name: 'Phạm Phương Linh', parentName: 'Anh Hùng', phone: '0984.444.555', groupId: 'grp_toan8a', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: false },
    { id: 'std_5', name: 'Hoàng Quốc Tuấn', parentName: 'Chị Thủy', phone: '0985.555.666', groupId: 'grp_toan8a', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: true },
    { id: 'std_6', name: 'Vũ Đức Anh', parentName: 'Anh Thành', phone: '0986.666.777', groupId: 'grp_toan9pro', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: true },
    { id: 'std_7', name: 'Đặng Thùy Dương', parentName: 'Chị Hương', phone: '0987.777.888', groupId: 'grp_toan9pro', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: true },
    { id: 'std_8', name: 'Bùi Gia Bách', parentName: 'Chị Vân', phone: '0988.888.999', groupId: 'grp_toan9pro', joinedAt: '2026-03-01T00:00:00.000Z', hasSubmitted: false },
  ];

  const availabilities: Record<string, StudentAvailabilityDoc> = {};
  for (const s of students) {
    const slots: Record<string, AvailabilityStatus> = {};
    for (const d of DAYS_CONFIG) {
      for (const sl of SLOTS_CONFIG) {
        const k = `${d.key}_${sl.id}`;
        slots[k] = (sl.id === 'c3' || sl.id === 'c4' || sl.id === 'ct') ? 'available' : 'unavailable';
      }
    }
    availabilities[s.id] = {
      studentId: s.id,
      groupId: s.groupId,
      availabilities: slots,
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
  }

  const schedules: ScheduleSession[] = [
    {
      id: 'sess_1',
      groupId: 'grp_toan8a',
      dayOfWeek: '2',
      slot: 'c3',
      startTime: '14:00',
      endTime: '15:30',
      isLocked: false,
      status: 'tentative',
      studentIds: ['std_1', 'std_2', 'std_3', 'std_5'],
    },
    {
      id: 'sess_2',
      groupId: 'grp_toan8a',
      dayOfWeek: '6',
      slot: 'c3',
      startTime: '14:00',
      endTime: '15:30',
      isLocked: false,
      status: 'tentative',
      studentIds: ['std_1', 'std_2', 'std_3', 'std_5'],
    },
  ];

  return {
    teacherConfig,
    groups,
    students,
    availabilities,
    schedules,
    lastOptimizationResult: null,
    isRealDataMode: false,
  };
}
