import {
  Group,
  Student,
  StudentAvailabilityDoc,
  TeacherConfig,
  ScheduleSession,
  OptimizationResult,
  UnassignedStudentDiagnostic,
  GroupSuggestion,
  ScheduleCombinationOption,
  GroupDifficulty,
  ImpactAnalysisResult,
  GlobalOptimizationProposal,
  DayKey,
  SlotKey,
  DAYS_CONFIG,
  SLOTS_CONFIG,
  normalizeSlotKey,
  getSlotLabel,
  getSlotTimeDisplay,
} from '../src/types.ts';

export function getSlotTimeKey(day: DayKey, slot: string): string {
  return `${day}_${normalizeSlotKey(slot)}`;
}

/**
 * Check if a student can attend a given slot
 */
export function getStudentSlotStatus(
  studentId: string,
  day: DayKey,
  slot: string,
  availabilities: Record<string, StudentAvailabilityDoc>
): 'preferred' | 'available' | 'unavailable' {
  const doc = availabilities[studentId];
  if (!doc?.availabilities) return 'unavailable';

  const normSlot = normalizeSlotKey(slot);
  const key = `${day}_${normSlot}`;
  if (doc.availabilities[key]) return doc.availabilities[key];

  // check legacy alias
  const def = SLOTS_CONFIG.find((s) => s.id === normSlot);
  if (def?.legacyAlias && doc.availabilities[`${day}_${def.legacyAlias}`]) {
    return doc.availabilities[`${day}_${def.legacyAlias}`];
  }

  return 'unavailable';
}

/**
 * Section 6 & 7: ANALYZE COMBINATIONS FOR A SINGLE GROUP
 * Computes feasible combinations of sessionsPerWeek slots.
 * Evaluates simultaneous attendance for every student across ALL sessions.
 */
export function analyzeGroupCombinations(
  groupId: string,
  groups: Group[],
  students: Student[],
  availabilities: Record<string, StudentAvailabilityDoc>,
  teacherConfig: TeacherConfig,
  schedules: ScheduleSession[]
): ScheduleCombinationOption[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];

  const groupStudents = students.filter((s) => s.groupId === groupId);
  const sessionsNeeded = group.sessionsPerWeek || 2;

  // Identify slots already occupied by teacher for OTHER groups (tentative, confirmed, locked)
  // map: slotKey -> { groupId, groupName }
  const occupiedTeacherSlots = new Map<string, { groupId: string; groupName: string }>();
  for (const sess of schedules) {
    if (sess.groupId !== groupId) {
      const otherGroup = groups.find((g) => g.id === sess.groupId);
      occupiedTeacherSlots.set(getSlotTimeKey(sess.dayOfWeek, sess.slot), {
        groupId: sess.groupId,
        groupName: otherGroup?.name || sess.groupId,
      });
    }
  }

  // Identify student busy slots from OTHER groups
  // set of `${studentId}_${day}_${slot}`
  const studentOccupiedSlots = new Set<string>();
  for (const sess of schedules) {
    if (sess.groupId !== groupId) {
      for (const sid of sess.studentIds) {
        studentOccupiedSlots.add(`${sid}_${getSlotTimeKey(sess.dayOfWeek, sess.slot)}`);
      }
    }
  }

  // Filter allowed candidate slots for this teacher & group
  interface CandidateSlot {
    day: DayKey;
    slot: SlotKey;
    key: string;
    startTime: string;
    endTime: string;
    isOccupied: boolean;
    occupiedByGroupName?: string;
  }

  const candidateSlots: CandidateSlot[] = [];

  for (const day of DAYS_CONFIG) {
    // Check group allowed days
    if (group.allowedDays && group.allowedDays.length > 0 && !group.allowedDays.includes(day.key)) {
      continue;
    }

    for (const slotDef of SLOTS_CONFIG) {
      // Check group allowed slots
      if (group.allowedSlots && group.allowedSlots.length > 0) {
        const hasSlot = group.allowedSlots.some((s) => normalizeSlotKey(s) === slotDef.id);
        if (!hasSlot) continue;
      }

      const key = getSlotTimeKey(day.key, slotDef.id);
      const timeInfo = getSlotTimeDisplay(day.key, slotDef.id, teacherConfig);

      // Must be enabled by teacher in settings
      if (!timeInfo.enabled) continue;

      const occupied = occupiedTeacherSlots.get(key);

      candidateSlots.push({
        day: day.key,
        slot: slotDef.id,
        key,
        startTime: timeInfo.startTime,
        endTime: timeInfo.endTime,
        isOccupied: !!occupied,
        occupiedByGroupName: occupied?.groupName,
      });
    }
  }

  // Generate combinations of size sessionsNeeded from slots where teacher is NOT occupied
  const availableCandidateSlots = candidateSlots.filter((c) => !c.isOccupied);

  // Helper to generate k-combinations
  function getCombinations<T>(arr: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const head = arr[0];
    const tail = arr.slice(1);
    const withHead = getCombinations(tail, k - 1).map((c) => [head, ...c]);
    const withoutHead = getCombinations(tail, k);
    return [...withHead, ...withoutHead];
  }

  // Strictly use availableCandidateSlots to prevent proposing teacher conflict
  const rawCombos = getCombinations(availableCandidateSlots, sessionsNeeded);

  // Evaluate each combination
  const evaluatedOptions: ScheduleCombinationOption[] = [];

  for (let idx = 0; idx < rawCombos.length; idx++) {
    const combo = rawCombos[idx];

    // Hard check: absolutely no occupied teacher slot
    if (combo.some((c) => c.isOccupied)) {
      continue;
    }

    const hasTeacherConflict = false;
    const teacherConflictNote = '';

    // Evaluate each student's attendance across ALL sessions in this combination
    const attendingStudents: ScheduleCombinationOption['attendingStudents'] = [];
    const unattendingStudents: ScheduleCombinationOption['unattendingStudents'] = [];
    const fullyMatchingStudents: { id: string; name: string; isPreferred: boolean }[] = [];
    const unavailableStudents: { id: string; name: string; sessionsAttending: number; reason: string }[] = [];
    const conflictStudents: { id: string; name: string; reason: string }[] = [];
    const notSubmittedStudents: { id: string; name: string }[] = [];

    let satisfactionCount = 0;
    let preferredCount = 0;
    let studentConflictsCount = 0;

    for (const student of groupStudents) {
      // 1. Check if student has submitted availability
      const availDoc = availabilities[student.id];
      if (!student.hasSubmitted || !availDoc) {
        notSubmittedStudents.push({ id: student.id, name: student.name });
        unattendingStudents.push({
          id: student.id,
          name: student.name,
          sessionsAttending: 0,
          reason: 'Chưa gửi lịch rảnh',
        });
        continue;
      }

      let sessionsAttending = 0;
      let isPreferredAll = true;
      let conflictInfo = '';
      let missingSlotInfo = '';
      let hasConflict = false;

      for (const slotItem of combo) {
        // HARD CONSTRAINT: Check if student has conflict in another group at this exact slot
        const isBusyInOtherGroup = studentOccupiedSlots.has(`${student.id}_${slotItem.key}`);
        if (isBusyInOtherGroup) {
          hasConflict = true;
          studentConflictsCount++;
          isPreferredAll = false;
          conflictInfo = `${DAYS_CONFIG.find((d) => d.key === slotItem.day)?.label} ${getSlotLabel(slotItem.slot)} (Trùng lịch với nhóm khác)`;
          continue;
        }

        const stat = getStudentSlotStatus(student.id, slotItem.day, slotItem.slot, availabilities);

        if (stat === 'preferred') {
          sessionsAttending++;
        } else if (stat === 'available') {
          sessionsAttending++;
          isPreferredAll = false;
        } else {
          isPreferredAll = false;
          missingSlotInfo = `${DAYS_CONFIG.find((d) => d.key === slotItem.day)?.label} ${getSlotLabel(slotItem.slot)} (Báo bận)`;
        }
      }

      const isFullyAttending = !hasConflict && sessionsAttending === sessionsNeeded;

      if (isFullyAttending) {
        satisfactionCount++;
        if (isPreferredAll) preferredCount++;
        attendingStudents.push({
          id: student.id,
          name: student.name,
          sessionsAttending,
          isFullyAttending: true,
          isPreferred: isPreferredAll,
        });
        fullyMatchingStudents.push({
          id: student.id,
          name: student.name,
          isPreferred: isPreferredAll,
        });
      } else if (hasConflict) {
        conflictStudents.push({
          id: student.id,
          name: student.name,
          reason: conflictInfo || 'Trùng lịch với nhóm khác',
        });
        unattendingStudents.push({
          id: student.id,
          name: student.name,
          sessionsAttending,
          reason: conflictInfo || 'Trùng lịch với nhóm khác',
        });
      } else {
        unavailableStudents.push({
          id: student.id,
          name: student.name,
          sessionsAttending,
          reason: missingSlotInfo || `Chỉ học được ${sessionsAttending}/${sessionsNeeded} buổi`,
        });
        unattendingStudents.push({
          id: student.id,
          name: student.name,
          sessionsAttending,
          reason: missingSlotInfo
            ? `Bận vào ${missingSlotInfo} (${sessionsAttending}/${sessionsNeeded} buổi)`
            : `Chỉ học được ${sessionsAttending}/${sessionsNeeded} buổi`,
        });
      }
    }

    // Spacing bonus: encourage spreading across the week (e.g. 2 sessions not on the same day)
    let spacingBonus = 0;
    const uniqueDays = new Set(combo.map((c) => c.day));
    if (uniqueDays.size === combo.length) {
      spacingBonus += 25; // Bonus for different days
    } else {
      spacingBonus -= 40; // Penalty for same-day sessions
    }

    // Composite score
    let score = satisfactionCount * 100 + preferredCount * 20 + spacingBonus;
    if (hasTeacherConflict) score -= 1000;
    if (studentConflictsCount > 0) score -= studentConflictsCount * 50;

    evaluatedOptions.push({
      id: `opt_${groupId}_${combo.map((c) => `${c.day}${c.slot}`).join('_')}`,
      groupId,
      sessions: combo.map((c) => ({
        dayOfWeek: c.day,
        slot: c.slot,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
      satisfactionCount,
      totalStudents: groupStudents.length,
      preferredCount,
      score,
      attendingStudents,
      unattendingStudents,
      fullyMatchingStudents,
      unavailableStudents,
      conflictStudents,
      notSubmittedStudents,
      hasTeacherConflict,
      teacherConflictNote,
      studentConflictsCount,
    });
  }

  // Sort: Non-conflicting first, then by satisfaction count, preferred count, and score
  evaluatedOptions.sort((a, b) => {
    // HARD CONSTRAINT: Options with teacher conflicts are strictly ranked last
    if (a.hasTeacherConflict !== b.hasTeacherConflict) {
      return a.hasTeacherConflict ? 1 : -1;
    }
    // Hard constraint: Options with fewer student conflicts rank higher
    if (a.studentConflictsCount !== b.studentConflictsCount) {
      return a.studentConflictsCount - b.studentConflictsCount;
    }
    if (b.satisfactionCount !== a.satisfactionCount) {
      return b.satisfactionCount - a.satisfactionCount;
    }
    if (b.preferredCount !== a.preferredCount) {
      return b.preferredCount - a.preferredCount;
    }
    return b.score - a.score;
  });

  // Pick top distinct options (up to 6)
  const topOptions = evaluatedOptions.slice(0, 6);
  if (topOptions.length > 0) {
    topOptions[0].isRecommended = true;
  }

  return topOptions;
}

/**
 * Section 17: ANALYZE GROUP SCHEDULING DIFFICULTY
 * Determines which groups should be scheduled first (Ưu tiên các nhóm khó xếp)
 */
export function analyzeGroupsDifficulty(
  groups: Group[],
  students: Student[],
  availabilities: Record<string, StudentAvailabilityDoc>,
  teacherConfig: TeacherConfig,
  schedules: ScheduleSession[]
): GroupDifficulty[] {
  const result: GroupDifficulty[] = [];

  for (const group of groups) {
    const groupStudents = students.filter((s) => s.groupId === group.id);
    // Analyze combinations assuming no teacher occupied slots from other groups yet (intrinsic flexibility)
    const options = analyzeGroupCombinations(
      group.id,
      groups,
      students,
      availabilities,
      teacherConfig,
      [] // empty schedules to see total potential
    );

    // Feasible options are those where at least 75% students can attend or max satisfaction
    const feasibleCount = options.filter(
      (opt) => opt.satisfactionCount >= Math.max(1, groupStudents.length - 1) && !opt.hasTeacherConflict
    ).length;

    let difficulty: 'very_hard' | 'hard' | 'medium' | 'easy' = 'easy';
    let difficultyLabel = 'RẤT DỄ';
    let reason = 'Học sinh có nhiều ca trùng nhau, dễ dàng chọn lịch';

    if (feasibleCount <= 1) {
      difficulty = 'very_hard';
      difficultyLabel = 'RẤT KHÓ';
      reason = 'Chỉ có 1 phương án khả thi hoặc học sinh rất ít ca rảnh chung';
    } else if (feasibleCount <= 3) {
      difficulty = 'hard';
      difficultyLabel = 'KHÓ';
      reason = 'Rất ít phương án khả thi, dễ bị chiếm ca nếu xếp sau';
    } else if (feasibleCount <= 6) {
      difficulty = 'medium';
      difficultyLabel = 'TRUNG BÌNH';
      reason = 'Có một số phương án phù hợp nhưng cần lưu ý ca giáo viên';
    }

    result.push({
      groupId: group.id,
      groupName: group.name,
      difficulty,
      difficultyLabel,
      feasibleCount,
      reason,
      studentCount: groupStudents.length,
      sessionsNeeded: group.sessionsPerWeek,
    });
  }

  // Sort: very_hard -> hard -> medium -> easy
  const difficultyWeight = { very_hard: 4, hard: 3, medium: 2, easy: 1 };
  result.sort((a, b) => difficultyWeight[b.difficulty] - difficultyWeight[a.difficulty]);

  return result;
}

/**
 * Section 13 & 14: IMPACT ANALYSIS WHEN MODIFYING A SESSION
 */
export function analyzeSessionChangeImpact(
  groupId: string,
  fromSessionId: string,
  toDay: DayKey,
  toSlot: SlotKey,
  groups: Group[],
  students: Student[],
  availabilities: Record<string, StudentAvailabilityDoc>,
  teacherConfig: TeacherConfig,
  schedules: ScheduleSession[]
): ImpactAnalysisResult {
  const group = groups.find((g) => g.id === groupId);
  const groupStudents = students.filter((s) => s.groupId === groupId);
  const toSlotNorm = normalizeSlotKey(toSlot);
  const targetKey = `${toDay}_${toSlotNorm}`;

  const timeInfo = getSlotTimeDisplay(toDay, toSlotNorm, teacherConfig);

  // Check teacher availability in settings
  if (!timeInfo.enabled) {
    return {
      canApply: false,
      satisfiedCount: 0,
      totalStudents: groupStudents.length,
      teacherConflict: 'Ca học này đã bị giáo viên TẮT trong phần Cài đặt ca.',
      studentConflicts: [],
      affectedGroups: [],
      warningNotes: ['Giáo viên không dạy ca này trong cài đặt thời gian.'],
      successNotes: [],
    };
  }

  // Check other groups using targetKey
  const occupyingSession = schedules.find(
    (s) => s.groupId !== groupId && getSlotTimeKey(s.dayOfWeek, s.slot) === targetKey
  );

  const affectedGroups: { groupName: string; reason: string }[] = [];
  let teacherConflict: string | undefined;

  if (occupyingSession) {
    const occGroup = groups.find((g) => g.id === occupyingSession.groupId);
    const grpName = occGroup?.name || occupyingSession.groupId;
    teacherConflict = `Ca ${toDay} ${getSlotLabel(toSlotNorm)} đang được sử dụng bởi nhóm "${grpName}".`;
    affectedGroups.push({
      groupName: grpName,
      reason: `Đang chiếm ca ${toDay} ${getSlotLabel(toSlotNorm)} (${occupyingSession.startTime} - ${occupyingSession.endTime})`,
    });
  }

  // Check student attendance on toDay, toSlot
  let satisfiedCount = 0;
  const studentConflicts: { studentName: string; conflictWithGroup: string }[] = [];
  const warningNotes: string[] = [];
  const successNotes: string[] = [];

  for (const student of groupStudents) {
    const stat = getStudentSlotStatus(student.id, toDay, toSlotNorm, availabilities);

    // Check if student has another session at this time in other groups
    const conflictSess = schedules.find(
      (s) =>
        s.groupId !== groupId &&
        s.studentIds.includes(student.id) &&
        getSlotTimeKey(s.dayOfWeek, s.slot) === targetKey
    );

    if (conflictSess) {
      const otherG = groups.find((g) => g.id === conflictSess.groupId);
      studentConflicts.push({
        studentName: student.name,
        conflictWithGroup: otherG?.name || conflictSess.groupId,
      });
    }

    if (stat === 'available' || stat === 'preferred') {
      satisfiedCount++;
    } else {
      warningNotes.push(`${student.name} không thể học ca này (Báo bận/không thể học).`);
    }
  }

  if (satisfiedCount === groupStudents.length) {
    successNotes.push(`Tất cả ${groupStudents.length}/${groupStudents.length} học sinh đều phù hợp ca mới.`);
  } else {
    successNotes.push(`${satisfiedCount}/${groupStudents.length} học sinh phù hợp ca mới.`);
  }

  const isGroupLocked = group?.isLocked === true || group?.status === 'locked';
  const isAllowedDay = group ? (group.allowedDays || []).includes(toDay) : true;
  const isAllowedSlot = group
    ? (group.allowedSlots || []).map(normalizeSlotKey).includes(toSlotNorm)
    : true;

  if (isGroupLocked) {
    warningNotes.push('Nhóm đã được khóa (LOCKED), không thể thay đổi ca học.');
  }
  if (!isAllowedDay) {
    warningNotes.push(`Thứ ${toDay} không nằm trong danh sách ngày cho phép của nhóm.`);
  }
  if (!isAllowedSlot) {
    warningNotes.push(`Ca ${getSlotLabel(toSlotNorm)} không nằm trong danh sách ca cho phép của nhóm.`);
  }
  if (studentConflicts.length > 0) {
    warningNotes.push(`Xung đột: Có ${studentConflicts.length} học sinh bị trùng lịch với nhóm khác ở ca này.`);
  }

  // HARD CONSTRAINTS: canApply MUST be false if any hard constraint is violated
  const canApply =
    !teacherConflict &&
    studentConflicts.length === 0 &&
    !isGroupLocked &&
    isAllowedDay &&
    isAllowedSlot &&
    timeInfo.enabled;

  return {
    canApply,
    satisfiedCount,
    totalStudents: groupStudents.length,
    teacherConflict,
    studentConflicts,
    affectedGroups,
    warningNotes,
    successNotes,
  };
}

/**
 * Section 16: GLOBAL OPTIMIZATION ANALYSIS
 * Discovers if swapping tentative groups can unlock a strictly better outcome
 */
export function analyzeGlobalOptimization(
  groups: Group[],
  students: Student[],
  availabilities: Record<string, StudentAvailabilityDoc>,
  teacherConfig: TeacherConfig,
  schedules: ScheduleSession[]
): GlobalOptimizationProposal {
  // Count current satisfied students
  let currentSatisfiedStudents = 0;
  for (const group of groups) {
    const groupStudents = students.filter((s) => s.groupId === group.id);
    const groupSessions = schedules.filter((s) => s.groupId === group.id);
    if (groupSessions.length >= group.sessionsPerWeek) {
      for (const st of groupStudents) {
        const canAll = groupSessions.every((sess) =>
          ['available', 'preferred'].includes(
            getStudentSlotStatus(st.id, sess.dayOfWeek, sess.slot, availabilities)
          )
        );
        if (canAll) currentSatisfiedStudents++;
      }
    }
  }

  // Look for potential swap between 2 tentative/confirmed groups that increases satisfaction
  const unlockedGroups = groups.filter((g) => !g.isLocked);
  const proposedChanges: GlobalOptimizationProposal['proposedChanges'] = [];
  let potentialSatisfiedStudents = currentSatisfiedStudents;

  // Evaluate single group improvements
  for (const g of unlockedGroups) {
    const options = analyzeGroupCombinations(
      g.id,
      groups,
      students,
      availabilities,
      teacherConfig,
      schedules
    );

    if (options.length > 0) {
      const best = options[0];
      const currentSessions = schedules.filter((s) => s.groupId === g.id);
      const currentSat = currentSessions.length > 0 ? (options.find((o) => o.id.includes(currentSessions[0].dayOfWeek))?.satisfactionCount || 0) : 0;

      if (best.satisfactionCount > currentSat && !best.hasTeacherConflict) {
        proposedChanges.push({
          groupId: g.id,
          groupName: g.name,
          fromSessions: currentSessions.map((s) => `${s.dayOfWeek} ${getSlotLabel(s.slot)}`),
          toSessions: best.sessions.map((s) => `${s.dayOfWeek} ${getSlotLabel(s.slot)}`),
          reason: `Tăng số học sinh đáp ứng từ ${currentSat} lên ${best.satisfactionCount}/${g.maxStudents} HS`,
        });
        potentialSatisfiedStudents += (best.satisfactionCount - currentSat);
      }
    }
  }

  const hasBetterPlan = proposedChanges.length > 0 && potentialSatisfiedStudents > currentSatisfiedStudents;

  return {
    currentSatisfiedStudents,
    potentialSatisfiedStudents,
    totalStudents: students.length,
    hasBetterPlan,
    proposedChanges,
    improvementNote: hasBetterPlan
      ? `Nếu thực hiện ${proposedChanges.length} điều chỉnh đề xuất, số học sinh được đáp ứng toàn diện sẽ tăng từ ${currentSatisfiedStudents} lên ${potentialSatisfiedStudents}/${students.length} HS.`
      : 'Lịch hiện tại đã đạt điểm tối ưu cục bộ cao nhất đối với các ràng buộc đã chọn.',
  };
}

/**
 * Standard overall optimization scheduler (Runs when teacher wants full or partial batch solve)
 */
export function runOptimizationScheduler(input: {
  groups: Group[];
  students: Student[];
  availabilities: Record<string, StudentAvailabilityDoc>;
  teacherConfig: TeacherConfig;
  existingSchedules: ScheduleSession[];
  mode: 'full' | 'partial';
}): OptimizationResult {
  const { groups, students, availabilities, teacherConfig, existingSchedules, mode } = input;

  const finalSessions: ScheduleSession[] = [];
  const teacherBookedSlots = new Set<string>();

  // Preserve locked sessions in ALL modes (never reschedule locked groups or sessions)
  for (const sess of existingSchedules) {
    const isGrpLocked = groups.find((g) => g.id === sess.groupId)?.isLocked;
    if (sess.isLocked || isGrpLocked || (mode === 'partial' && sess.status === 'confirmed')) {
      finalSessions.push(sess);
      teacherBookedSlots.add(getSlotTimeKey(sess.dayOfWeek, sess.slot));
    }
  }

  // Sort groups by difficulty: very_hard first
  const difficulties = analyzeGroupsDifficulty(
    groups,
    students,
    availabilities,
    teacherConfig,
    finalSessions
  );

  const sortedGroups = [...groups].sort((a, b) => {
    if (a.isLocked && !b.isLocked) return -1;
    if (!a.isLocked && b.isLocked) return 1;
    const diffA = difficulties.find((d) => d.groupId === a.id)?.feasibleCount ?? 99;
    const diffB = difficulties.find((d) => d.groupId === b.id)?.feasibleCount ?? 99;
    return diffA - diffB;
  });

  for (const group of sortedGroups) {
    // HARD CONSTRAINT: Never modify a locked group under any mode
    if (group.isLocked) continue;

    const options = analyzeGroupCombinations(
      group.id,
      groups,
      students,
      availabilities,
      teacherConfig,
      finalSessions
    );

    // HARD CONSTRAINT: Never assign a session with teacher conflict
    const validOptions = options.filter((o) => !o.hasTeacherConflict);

    if (validOptions.length > 0) {
      const best = validOptions[0];
      for (const sess of best.sessions) {
        const timeInfo = getSlotTimeDisplay(sess.dayOfWeek, sess.slot, teacherConfig);
        const attending = best.attendingStudents.map((s) => s.id);

        const newSession: ScheduleSession = {
          id: `sess_${group.id}_${sess.dayOfWeek}_${sess.slot}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          groupId: group.id,
          dayOfWeek: sess.dayOfWeek,
          slot: sess.slot,
          startTime: timeInfo.startTime,
          endTime: timeInfo.endTime,
          isLocked: group.isLocked,
          status: group.isLocked ? 'locked' : 'tentative',
          studentIds: attending,
        };

        finalSessions.push(newSession);
        teacherBookedSlots.add(getSlotTimeKey(sess.dayOfWeek, sess.slot));
      }
    }
  }

  // Build diagnostics
  let totalScheduledStudents = 0;
  const unassignedDiagnostics: UnassignedStudentDiagnostic[] = [];

  for (const group of groups) {
    const groupStudents = students.filter((s) => s.groupId === group.id);
    const groupSessions = finalSessions.filter((s) => s.groupId === group.id);

    for (const student of groupStudents) {
      const studentSessions = groupSessions.filter((s) => s.studentIds.includes(student.id));
      if (studentSessions.length >= group.sessionsPerWeek) {
        totalScheduledStudents++;
      } else {
        unassignedDiagnostics.push({
          studentId: student.id,
          studentName: student.name,
          groupId: group.id,
          groupName: group.name,
          reasons: [`Học sinh chỉ đáp ứng được ${studentSessions.length}/${group.sessionsPerWeek} buổi của nhóm`],
          suggestions: ['Xem xét chuyển sang tổ hợp ca khác hoặc liên hệ phụ huynh mở thêm ca rảnh'],
          submittedSlotsCount: 1,
          availableSlotsCount: 1,
          preferredSlotsCount: 0,
        });
      }
    }
  }

  const groupSummaries = groups.map((g) => {
    const sessions = finalSessions.filter((s) => s.groupId === g.id);
    return {
      groupId: g.id,
      groupName: g.name,
      status: g.status,
      sessions: sessions.map((sess) => ({
        dayOfWeek: sess.dayOfWeek,
        slot: sess.slot,
        startTime: sess.startTime,
        endTime: sess.endTime,
        studentCount: sess.studentIds.length,
        students: sess.studentIds.map((id) => {
          const st = students.find((s) => s.id === id);
          return { id, name: st ? st.name : id };
        }),
      })),
      unmetSessions: Math.max(0, g.sessionsPerWeek - sessions.length),
    };
  });

  return {
    success: true,
    scheduledStudentsCount: totalScheduledStudents,
    unscheduledStudentsCount: unassignedDiagnostics.length,
    totalStudents: students.length,
    satisfactionRate: students.length > 0 ? Math.round((totalScheduledStudents / students.length) * 100) : 100,
    totalSessionsScheduled: finalSessions.length,
    unassignedStudents: unassignedDiagnostics,
    groupSummaries,
    conflicts: [],
    timestamp: new Date().toISOString(),
    mode,
  };
}

/**
 * Section 21: Auto-Group Suggestions
 */
export function generateGroupSuggestions(
  students: Student[],
  availabilities: Record<string, StudentAvailabilityDoc>,
  teacherConfig: TeacherConfig,
  existingGroups: Group[]
): GroupSuggestion[] {
  const suggestions: GroupSuggestion[] = [];
  let suggestionIndex = 1;

  for (const day of DAYS_CONFIG) {
    for (const slotDef of SLOTS_CONFIG) {
      const key = getSlotTimeKey(day.key, slotDef.id);
      const timeInfo = getSlotTimeDisplay(day.key, slotDef.id, teacherConfig);
      if (!timeInfo.enabled) continue;

      const matchingStudents: { id: string; name: string; score: number }[] = [];

      for (const st of students) {
        const stat = getStudentSlotStatus(st.id, day.key, slotDef.id, availabilities);
        if (stat === 'preferred') {
          matchingStudents.push({ id: st.id, name: st.name, score: 3 });
        } else if (stat === 'available') {
          matchingStudents.push({ id: st.id, name: st.name, score: 1 });
        }
      }

      if (matchingStudents.length >= 3) {
        // Derive subject and grade from existing groups or students' groups if available
        const defaultSubject = existingGroups[0]?.subject || 'Toán';
        const defaultGrade = existingGroups[0]?.grade || 'Khối 8';

        suggestions.push({
          id: `sug_${Date.now()}_${suggestionIndex}`,
          suggestedName: `Nhóm Đề Xuất ${suggestionIndex} (${day.label} ${slotDef.label})`,
          subject: defaultSubject,
          grade: defaultGrade,
          dayOfWeek: day.key,
          slot: slotDef.id,
          startTime: timeInfo.startTime,
          endTime: timeInfo.endTime,
          studentIds: matchingStudents.map((s) => s.id),
          studentNames: matchingStudents.map((s) => s.name),
          matchScore: matchingStudents.reduce((acc, cur) => acc + cur.score, 0),
        });
        suggestionIndex++;
        if (suggestions.length >= 4) break;
      }
    }
    if (suggestions.length >= 4) break;
  }

  return suggestions;
}
