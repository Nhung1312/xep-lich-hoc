/**
 * Types and interfaces for the Auto-Scheduling System
 */

export type DayKey = '2' | '3' | '4' | '5' | '6' | '7' | 'CN';

// Standard 5 unified slots: CA 1, CA 2, CA 3, CA 4, CA TỐI
export type SlotKey = 'c1' | 'c2' | 'c3' | 'c4' | 'ct' | 'm1' | 'm2' | 'a1' | 'a2' | 'e1';

export type AvailabilityStatus = 'available' | 'preferred' | 'unavailable';

export interface SlotDefinition {
  id: 'c1' | 'c2' | 'c3' | 'c4' | 'ct';
  label: string;
  defaultStartTime: string;
  defaultEndTime: string;
  legacyAlias?: string;
}

export interface DaySlotTime {
  dayOfWeek: DayKey;
  slot: SlotKey;
  startTime: string;
  endTime: string;
  enabled: boolean; // teacher can teach or not
}

export interface TeacherConfig {
  teacherId: string;
  teacherName: string;
  phone: string;
  // Default template for the 5 ca:
  defaultSlotTimes?: Record<'c1' | 'c2' | 'c3' | 'c4' | 'ct', { startTime: string; endTime: string; enabled: boolean }>;
  // Specific day-slot override: key `${day}_${slot}`
  slotTimes: Record<string, { startTime: string; endTime: string; enabled: boolean; customName?: string }>;
}

export type GroupStatus = 'draft' | 'analyzing' | 'tentative' | 'confirmed' | 'locked';

export interface Group {
  id: string;
  code: string; // e.g. "TOAN8A26"
  name: string; // e.g. "Toán 8A"
  subject: string; // e.g. "Toán"
  grade: string; // e.g. "Khối 8"
  maxStudents: number; // e.g. 8
  sessionsPerWeek: number; // e.g. 2
  durationMinutes: number; // e.g. 90
  allowedDays: DayKey[]; // e.g. ['2', '3', '4', '5', '6', '7']
  allowedSlots: SlotKey[]; // e.g. ['c1', 'c2', 'c3', 'c4', 'ct']
  teacherId: string;
  isLocked: boolean;
  status: GroupStatus;
  selectedOptionId?: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  phone?: string;
  parentId?: string;
  parentName?: string;
  parentToken?: string; // Token for parent to access and edit their child's availability securely
  groupId: string;
  joinedAt: string;
  hasSubmitted: boolean;
}

export interface AppState {
  teacherConfig: TeacherConfig;
  groups: Group[];
  students: Student[];
  availabilities: Record<string, StudentAvailabilityDoc>;
  schedules: ScheduleSession[];
  lastOptimizationResult: OptimizationResult | null;
  isRealDataMode?: boolean;
}

export interface StudentAvailabilityDoc {
  studentId: string;
  groupId: string;
  updatedAt: string;
  availabilities: Record<string, AvailabilityStatus>; // key: `${day}_${slot}`
}

export interface ScheduleSession {
  id: string;
  groupId: string;
  dayOfWeek: DayKey;
  slot: SlotKey;
  startTime: string;
  endTime: string;
  isLocked: boolean;
  status?: 'tentative' | 'confirmed' | 'locked';
  studentIds: string[];
}

// Feasible combination option for a group
export interface ScheduleCombinationOption {
  id: string;
  groupId: string;
  sessions: {
    dayOfWeek: DayKey;
    slot: SlotKey;
    startTime: string;
    endTime: string;
  }[];
  satisfactionCount: number; // number of students who can attend ALL sessions
  totalStudents: number;
  preferredCount: number;
  score: number;
  attendingStudents: {
    id: string;
    name: string;
    sessionsAttending: number;
    isFullyAttending: boolean;
    isPreferred: boolean;
  }[];
  unattendingStudents: {
    id: string;
    name: string;
    sessionsAttending: number;
    reason: string;
  }[];
  fullyMatchingStudents?: {
    id: string;
    name: string;
    isPreferred: boolean;
  }[];
  unavailableStudents?: {
    id: string;
    name: string;
    sessionsAttending: number;
    reason: string;
  }[];
  conflictStudents?: {
    id: string;
    name: string;
    reason: string;
  }[];
  notSubmittedStudents?: {
    id: string;
    name: string;
  }[];
  hasTeacherConflict: boolean;
  teacherConflictNote?: string;
  studentConflictsCount: number;
  isRecommended?: boolean;
}

// Group scheduling difficulty rating
export interface GroupDifficulty {
  groupId: string;
  groupName: string;
  difficulty: 'very_hard' | 'hard' | 'medium' | 'easy';
  difficultyLabel: string;
  feasibleCount: number;
  reason: string;
  studentCount: number;
  sessionsNeeded: number;
}

// Impact analysis when changing a session
export interface ImpactAnalysisResult {
  canApply: boolean;
  satisfiedCount: number;
  totalStudents: number;
  teacherConflict?: string;
  studentConflicts: { studentName: string; conflictWithGroup: string }[];
  affectedGroups: { groupName: string; reason: string }[];
  warningNotes: string[];
  successNotes: string[];
}

// Global optimization proposal (Section 16)
export interface GlobalOptimizationProposal {
  currentSatisfiedStudents: number;
  potentialSatisfiedStudents: number;
  totalStudents: number;
  hasBetterPlan: boolean;
  proposedChanges: {
    groupId: string;
    groupName: string;
    fromSessions: string[];
    toSessions: string[];
    reason: string;
  }[];
  improvementNote: string;
}

export interface UnassignedStudentDiagnostic {
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  reasons: string[];
  suggestions: string[];
  submittedSlotsCount: number;
  availableSlotsCount: number;
  preferredSlotsCount: number;
}

export interface OptimizationResult {
  success: boolean;
  scheduledStudentsCount: number;
  unscheduledStudentsCount: number;
  totalStudents: number;
  satisfactionRate: number; // percentage (0-100)
  totalSessionsScheduled: number;
  unassignedStudents: UnassignedStudentDiagnostic[];
  groupSummaries: {
    groupId: string;
    groupName: string;
    status: GroupStatus;
    sessions: {
      dayOfWeek: DayKey;
      slot: SlotKey;
      startTime: string;
      endTime: string;
      studentCount: number;
      students: { id: string; name: string }[];
    }[];
    unmetSessions: number;
  }[];
  conflicts: string[];
  timestamp: string;
  mode: 'full' | 'partial';
}

export interface GroupSuggestion {
  id: string;
  suggestedName: string;
  subject: string;
  grade: string;
  dayOfWeek: DayKey;
  slot: SlotKey;
  startTime: string;
  endTime: string;
  studentIds: string[];
  studentNames: string[];
  matchScore: number;
}

export const DAYS_CONFIG: { key: DayKey; label: string; fullLabel: string }[] = [
  { key: '2', label: 'T2', fullLabel: 'Thứ Hai' },
  { key: '3', label: 'T3', fullLabel: 'Thứ Ba' },
  { key: '4', label: 'T4', fullLabel: 'Thứ Tư' },
  { key: '5', label: 'T5', fullLabel: 'Thứ Năm' },
  { key: '6', label: 'T6', fullLabel: 'Thứ Sáu' },
  { key: '7', label: 'T7', fullLabel: 'Thứ Bảy' },
  { key: 'CN', label: 'CN', fullLabel: 'Chủ Nhật' },
];

/**
 * Standard 5 Unified Slots (Bỏ gọi Sáng/Chiều/Tối - Chuẩn hóa CA 1 -> CA TỐI)
 */
export const SLOTS_CONFIG: SlotDefinition[] = [
  {
    id: 'c1',
    label: 'CA 1',
    defaultStartTime: '07:30',
    defaultEndTime: '09:00',
    legacyAlias: 'm1',
  },
  {
    id: 'c2',
    label: 'CA 2',
    defaultStartTime: '09:15',
    defaultEndTime: '10:45',
    legacyAlias: 'm2',
  },
  {
    id: 'c3',
    label: 'CA 3',
    defaultStartTime: '14:00',
    defaultEndTime: '15:30',
    legacyAlias: 'a1',
  },
  {
    id: 'c4',
    label: 'CA 4',
    defaultStartTime: '15:45',
    defaultEndTime: '17:15',
    legacyAlias: 'a2',
  },
  {
    id: 'ct',
    label: 'CA TỐI',
    defaultStartTime: '19:00',
    defaultEndTime: '20:30',
    legacyAlias: 'e1',
  },
];

/**
 * Normalization helper ensuring standard slot key format ('c1', 'c2', 'c3', 'c4', 'ct')
 */
export function normalizeSlotKey(slot: string): 'c1' | 'c2' | 'c3' | 'c4' | 'ct' {
  if (slot === 'c1' || slot === 'm1') return 'c1';
  if (slot === 'c2' || slot === 'm2') return 'c2';
  if (slot === 'c3' || slot === 'a1') return 'c3';
  if (slot === 'c4' || slot === 'a2') return 'c4';
  if (slot === 'ct' || slot === 'e1') return 'ct';
  return 'c1';
}

/**
 * Get slot display label
 */
export function getSlotLabel(slot: string): string {
  const norm = normalizeSlotKey(slot);
  const found = SLOTS_CONFIG.find((s) => s.id === norm);
  return found ? found.label : slot;
}

/**
 * Format slot time from teacher config or defaults
 */
export function getSlotTimeDisplay(
  day: DayKey,
  slot: string,
  teacherConfig?: TeacherConfig
): { startTime: string; endTime: string; label: string; enabled: boolean } {
  const norm = normalizeSlotKey(slot);
  const slotDef = SLOTS_CONFIG.find((s) => s.id === norm) || SLOTS_CONFIG[0];
  const key = `${day}_${norm}`;
  const legacyKey = slotDef.legacyAlias ? `${day}_${slotDef.legacyAlias}` : null;

  const conf =
    teacherConfig?.slotTimes?.[key] ||
    (legacyKey ? teacherConfig?.slotTimes?.[legacyKey] : undefined) ||
    teacherConfig?.defaultSlotTimes?.[norm];

  return {
    startTime: conf?.startTime || slotDef.defaultStartTime,
    endTime: conf?.endTime || slotDef.defaultEndTime,
    label: slotDef.label,
    enabled: conf?.enabled !== false,
  };
}

// Runtime placeholders for Node.js native ESM type stripping compatibility
export const DayKey = undefined;
export const SlotKey = undefined;
export const AvailabilityStatus = undefined;
export const GroupStatus = undefined;
export const SlotDefinition = undefined;
export const DaySlotTime = undefined;
export const TeacherConfig = undefined;
export const Group = undefined;
export const Student = undefined;
export const StudentAvailabilityDoc = undefined;
export const ScheduleSession = undefined;
export const OptimizationResult = undefined;
export const UnassignedStudentDiagnostic = undefined;
export const GroupSuggestion = undefined;
export const ScheduleCombinationOption = undefined;
export const GroupDifficulty = undefined;
export const ImpactAnalysisResult = undefined;
export const GlobalOptimizationProposal = undefined;
export const AppDatabase = undefined;
