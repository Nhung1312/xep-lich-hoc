import React, { useState } from 'react';
import { Group, Student, ScheduleSession, DAYS_CONFIG, SLOTS_CONFIG, getSlotLabel } from '../types.ts';
import {
  Lock,
  Unlock,
  Users,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  QrCode,
  Edit3,
  Sparkles,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

interface Props {
  groups: Group[];
  students: Student[];
  schedules: ScheduleSession[];
  onToggleLockGroup: (groupId: string, isLocked: boolean) => void;
  onConfirmGroup?: (groupId: string) => void;
  onResetGroup?: (groupId: string) => void;
  onOpenQR: (group: Group) => void;
  onManualEdit: (group: Group) => void;
  onAnalyzeGroup?: (group: Group) => void;
}

export const ScheduleByGroup: React.FC<Props> = ({
  groups,
  students,
  schedules,
  onToggleLockGroup,
  onConfirmGroup,
  onResetGroup,
  onOpenQR,
  onManualEdit,
  onAnalyzeGroup,
}) => {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Chưa có nhóm học nào. Vui lòng tạo nhóm để bắt đầu.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupStudents = students.filter((s) => s.groupId === group.id);
        const groupSessions = schedules.filter((s) => s.groupId === group.id);
        const isExpanded = expandedGroupId === group.id;
        const isSatisfied = groupSessions.length >= group.sessionsPerWeek;
        const isLocked = !!(group.isLocked || group.status === 'locked');
        const isConfirmed = group.status === 'confirmed' && !isLocked;
        const isTentative = (group.status === 'tentative' || (groupSessions.length > 0 && group.status !== 'confirmed')) && !isLocked;
        const isDraft = !isLocked && !isConfirmed && !isTentative && groupSessions.length === 0;

        return (
          <div
            key={group.id}
            className={`rounded-xl border bg-white shadow-xs transition-all overflow-hidden ${
              isLocked
                ? 'border-slate-400'
                : isConfirmed
                ? 'border-emerald-300'
                : isTentative
                ? 'border-amber-300'
                : 'border-slate-200'
            }`}
          >
            {/* Group Header */}
            <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleLockGroup(group.id, !isLocked)}
                  title={isLocked ? 'Nhóm đã khóa lịch (bấm để mở khóa)' : 'Bấm để khóa cố định lịch nhóm'}
                  className={`p-2 rounded-lg border transition-colors ${
                    isLocked
                      ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Mã: {group.code}
                    </span>

                    {/* 4 Status Badges */}
                    {isLocked ? (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-900 text-white flex items-center gap-1 shadow-2xs">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Đã khóa chính thức 🔒</span>
                      </span>
                    ) : isConfirmed ? (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Đã chốt lịch ✓</span>
                      </span>
                    ) : isTentative ? (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Lịch dự kiến</span>
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
                        Chưa xếp lịch
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {group.subject} • {group.grade} • Mục tiêu: <b>{group.sessionsPerWeek} buổi/tuần</b> ({group.durationMinutes} phút/buổi) • Sĩ số tối đa: <b>{group.maxStudents} HS</b>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Analyze & Suggest Button */}
                {onAnalyzeGroup && !isLocked && (
                  <button
                    onClick={() => onAnalyzeGroup(group)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Phân tích và đề xuất các tổ hợp ca cho nhóm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Đề xuất lịch</span>
                  </button>
                )}

                {/* Confirm Group Schedule button (when tentative) */}
                {isTentative && onConfirmGroup && (
                  <button
                    onClick={() => onConfirmGroup(group.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Xác nhận chốt lịch nhóm này"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Chốt lịch</span>
                  </button>
                )}

                {/* Manual Edit Button */}
                {!isLocked && (
                  <button
                    onClick={() => onManualEdit(group)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sửa lịch</span>
                  </button>
                )}

                {/* Reset Group button */}
                {!isLocked && groupSessions.length > 0 && onResetGroup && (
                  <button
                    onClick={() => onResetGroup(group.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Xóa lịch hiện tại để xếp lại nhóm này"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span>Đặt lại</span>
                  </button>
                )}

                {/* Lock / Unlock Toggle Button */}
                <button
                  onClick={() => onToggleLockGroup(group.id, !isLocked)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs border ${
                    isLocked
                      ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={isLocked ? 'Bấm để mở khóa nhóm' : 'Khóa cố định lịch nhóm không cho thay đổi'}
                >
                  {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{isLocked ? 'Mở khóa' : 'Khóa lịch'}</span>
                </button>

                <button
                  onClick={() => onOpenQR(group)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Mã QR & Link</span>
                </button>

                <button
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Scheduled Sessions Preview */}
            <div className="p-4 sm:p-5 border-t border-slate-100">
              {groupSessions.length === 0 ? (
                <div className="flex items-center justify-between text-xs text-amber-800 bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Chưa có lịch cho nhóm này.</span>
                  </div>
                  {onAnalyzeGroup && (
                    <button
                      onClick={() => onAnalyzeGroup(group)}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tìm phương án ngay</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      Các ca học đang xếp ({groupSessions.length}/{group.sessionsPerWeek} buổi):
                    </span>
                    {!isSatisfied && (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200 text-[11px]">
                        Cần thêm {group.sessionsPerWeek - groupSessions.length} buổi
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {groupSessions.map((sess) => {
                      const dayObj = DAYS_CONFIG.find((d) => d.key === sess.dayOfWeek);
                      const slotLabel = getSlotLabel(sess.slot);

                      return (
                        <div
                          key={sess.id}
                          className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 flex flex-col justify-between text-xs"
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-bold text-indigo-950">
                              {dayObj?.fullLabel} ({dayObj?.label})
                            </span>
                            <span className="font-mono text-indigo-700 font-semibold">
                              {sess.startTime} - {sess.endTime}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-slate-600">
                            <span className="font-medium text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              {slotLabel}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-slate-800 text-xs">
                              <Users className="w-3.5 h-3.5 text-indigo-600" />
                              {sess.studentIds.length}/{group.maxStudents} HS
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Student List */}
            {isExpanded && (
              <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-200/80 text-xs">
                <div className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>Danh sách học sinh trong nhóm ({groupStudents.length}/{group.maxStudents} HS):</span>
                  <span className="text-slate-500 font-normal">
                    Đã gửi lịch: <b>{groupStudents.filter((s) => s.hasSubmitted).length}</b> / {groupStudents.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {groupStudents.map((st) => (
                    <div
                      key={st.id}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{st.name}</div>
                        <div className="text-[11px] text-slate-500">{st.phone || 'Chưa có SĐT'}</div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          st.hasSubmitted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {st.hasSubmitted ? 'Đã gửi lịch' : 'Chưa gửi'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
