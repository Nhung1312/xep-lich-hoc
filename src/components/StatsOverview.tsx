import React, { useState, useEffect } from 'react';
import { Group, Student, ScheduleSession, GroupDifficulty } from '../types.ts';
import { api } from '../api.ts';
import {
  Layers,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Sliders,
  UserPlus,
  Lock,
  Calendar,
  Compass,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface Props {
  groups: Group[];
  students: Student[];
  schedules: ScheduleSession[];
  groupDifficulties?: GroupDifficulty[];
  unscheduledCount?: number;
  onAutoSchedule: (mode: 'full' | 'partial') => void;
  onOpenSlotSettings: () => void;
  onOpenAutoGroup: () => void;
  onOpenGlobalAnalysis: () => void;
  onSelectGroupToSchedule?: (groupId: string) => void;
  isScheduling: boolean;
}

export const StatsOverview: React.FC<Props> = ({
  groups = [],
  students = [],
  schedules = [],
  groupDifficulties,
  unscheduledCount,
  onAutoSchedule,
  onOpenSlotSettings,
  onOpenAutoGroup,
  onOpenGlobalAnalysis,
  onSelectGroupToSchedule,
  isScheduling,
}) => {
  const [internalDifficulties, setInternalDifficulties] = useState<GroupDifficulty[]>([]);

  useEffect(() => {
    if (groupDifficulties && groupDifficulties.length > 0) {
      setInternalDifficulties(groupDifficulties);
      return;
    }
    // Dynamically query difficulty ranking if not supplied as prop
    let isMounted = true;
    api
      .getGroupDifficulties()
      .then((res) => {
        if (isMounted && res?.difficulties) {
          setInternalDifficulties(res.difficulties);
        }
      })
      .catch((err) => {
        console.warn('Could not load group difficulties', err);
      });
    return () => {
      isMounted = false;
    };
  }, [groupDifficulties, groups, schedules]);

  const effectiveDifficulties =
    groupDifficulties && groupDifficulties.length > 0
      ? groupDifficulties
      : internalDifficulties;

  const totalGroups = groups.length;
  const totalStudents = students.length;

  // Counts by status
  const tentativeGroupsCount = groups.filter((g) => g.status === 'tentative').length;
  const confirmedGroupsCount = groups.filter((g) => g.status === 'confirmed').length;
  const lockedGroupsCount = groups.filter((g) => g.isLocked || g.status === 'locked').length;

  // Calculate satisfied students (attended sessionsPerWeek)
  let satisfiedStudentsCount = 0;
  for (const group of groups) {
    const groupStudents = students.filter((s) => s.groupId === group.id);
    const groupSessions = schedules.filter((s) => s.groupId === group.id);
    for (const st of groupStudents) {
      const studentSessionCount = groupSessions.filter((s) => s.studentIds.includes(st.id)).length;
      if (studentSessionCount >= group.sessionsPerWeek && group.sessionsPerWeek > 0) {
        satisfiedStudentsCount++;
      }
    }
  }

  // Groups with issues (e.g. less sessions than needed or draft status)
  const problematicGroupsCount = groups.filter((g) => {
    const groupSessions = schedules.filter((s) => s.groupId === g.id);
    return groupSessions.length < g.sessionsPerWeek || g.status === 'draft';
  }).length;

  // Distinct active slots in use (day_slot) out of 35 total (7 days x 5 slots)
  const usedSlotsSet = new Set((schedules || []).map((s) => `${s.dayOfWeek}_${s.slot}`));
  const totalSlotsInUse = usedSlotsSet.size;

  // Find hardest unscheduled group for recommendation banner (Section 17)
  const hardestUnscheduled = (effectiveDifficulties || []).find((d) => {
    const grp = (groups || []).find((g) => g.id === d.groupId);
    return grp && (grp.status === 'draft' || grp.status === 'analyzing');
  });

  return (
    <div className="space-y-3.5">
      {/* 8 Metric KPI Cards (Section 18) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* 1. Tổng số nhóm */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>TỔNG NHÓM</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">{totalGroups}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">nhóm học</div>
        </div>

        {/* 2. Tổng số học sinh */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>HỌC SINH</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">{totalStudents}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">học sinh</div>
        </div>

        {/* 3. Đã chọn phương án (Dự kiến) */}
        <div className="p-3 bg-white rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs">
          <div className="text-[11px] text-amber-800 font-medium flex items-center justify-between">
            <span>LỊCH DỰ KIẾN</span>
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-900 mt-1">
            {tentativeGroupsCount}
            <span className="text-xs text-slate-400 font-normal">/{totalGroups}</span>
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5">nhóm tạm chọn</div>
        </div>

        {/* 4. Đã xác nhận */}
        <div className="p-3 bg-white rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="text-[11px] text-emerald-800 font-medium flex items-center justify-between">
            <span>ĐÃ XÁC NHẬN</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-800 mt-1">
            {confirmedGroupsCount}
            <span className="text-xs text-slate-400 font-normal">/{totalGroups}</span>
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">nhóm sẵn sàng</div>
        </div>

        {/* 5. Đã khóa */}
        <div className="p-3 bg-white rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-2xs">
          <div className="text-[11px] text-indigo-800 font-medium flex items-center justify-between">
            <span>ĐÃ KHÓA</span>
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-indigo-800 mt-1">
            {lockedGroupsCount}
            <span className="text-xs text-slate-400 font-normal">/{totalGroups}</span>
          </div>
          <div className="text-[10px] text-indigo-700 mt-0.5">ràng buộc cố định</div>
        </div>

        {/* 6. Học sinh được đáp ứng */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-emerald-700 font-medium flex items-center justify-between">
            <span>ĐÁP ỨNG ĐỦ</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {satisfiedStudentsCount}
            <span className="text-xs text-slate-400 font-normal">/{totalStudents}</span>
          </div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">
            {totalStudents > 0 ? Math.round((satisfiedStudentsCount / totalStudents) * 100) : 0}% trọn vẹn
          </div>
        </div>

        {/* 7. Nhóm gặp vấn đề / chưa xếp */}
        <div
          className={`p-3 rounded-xl border shadow-2xs ${
            problematicGroupsCount > 0 ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-[11px] font-medium flex items-center justify-between text-rose-800">
            <span>CẦN XẾP / XỬ LÝ</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-800 mt-1">{problematicGroupsCount}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">nhóm cần lưu ý</div>
        </div>

        {/* 8. Ca đang sử dụng */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-purple-700 font-medium flex items-center justify-between">
            <span>CA ĐANG DÙNG</span>
            <Clock className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-black text-purple-800 mt-1">
            {totalSlotsInUse}
            <span className="text-xs text-slate-400 font-normal">/35</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">khung giờ/tuần</div>
        </div>
      </div>

      {/* Section 17 Recommendation Alert Banner */}
      {hardestUnscheduled && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-amber-200 text-amber-800 font-bold shrink-0">
              ⚠️ GỢI Ý THỨ TỰ
            </span>
            <span>
              Nên ưu tiên xếp nhóm <b>{hardestUnscheduled.groupName}</b> trước vì nhóm này có{' '}
              <b>độ khó {hardestUnscheduled.difficultyLabel}</b> ({hardestUnscheduled.feasibleCount} phương án khả thi).
            </span>
          </div>
          {onSelectGroupToSchedule && (
            <button
              onClick={() => onSelectGroupToSchedule(hardestUnscheduled.groupId)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
            >
              <span>Xếp nhóm này ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Action Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Optimization Analysis Button (Section 16) */}
          <button
            id="btn-global-analysis"
            onClick={onOpenGlobalAnalysis}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            title="Phân tích toàn bộ hệ thống để phát hiện các phương án hoán đổi tăng tối đa số học sinh được đáp ứng"
          >
            <Compass className="w-4 h-4 text-violet-200" />
            <span>PHÂN TÍCH TOÀN BỘ</span>
          </button>

          {/* Quick Auto-Schedule (Batch solver if teacher wants one-click baseline) */}
          <button
            id="btn-auto-schedule"
            onClick={() => onAutoSchedule('full')}
            disabled={isScheduling}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            title="Chạy tự động đề xuất phương án tối ưu cho tất cả các nhóm"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{isScheduling ? 'Đang xếp lịch...' : 'Tự động gợi ý tất cả'}</span>
          </button>
        </div>

        {/* Secondary Config Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-auto-group"
            onClick={onOpenAutoGroup}
            className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Ghép nhóm tự động</span>
          </button>

          <button
            id="btn-slot-settings"
            onClick={onOpenSlotSettings}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Cài đặt ca & Giờ học (5 ca)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
