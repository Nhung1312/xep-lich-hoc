import React from 'react';
import { OptimizationResult } from '../types.ts';
import {
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  X,
  Users,
  CalendarCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface Props {
  result: OptimizationResult | null;
  onClose: () => void;
  onViewSchedule: () => void;
  onReschedule: (mode: 'full' | 'partial') => void;
}

export const OptimizationResultModal: React.FC<Props> = ({
  result,
  onClose,
  onViewSchedule,
  onReschedule,
}) => {
  if (!result) return null;

  return (
    <div
      id="opt-result-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="opt-result-modal"
        className="w-full max-w-3xl my-8 rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                Kết Quả Tự Động Xếp Lịch Tối Ưu
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Chế độ: {result.mode === 'partial' ? 'Xếp lại phần chưa phù hợp (Giữ lịch đã khóa)' : 'Xếp lại toàn bộ'} •{' '}
              {new Date(result.timestamp).toLocaleTimeString('vi-VN')} {new Date(result.timestamp).toLocaleDateString('vi-VN')}
            </p>
          </div>
          <button
            id="btn-close-opt-result"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 py-4 space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
                <span>Đã xếp thành công</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-800">
                  {result.scheduledStudentsCount}
                </span>
                <span className="text-xs text-emerald-600 font-medium">
                  / {result.totalStudents} HS
                </span>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                result.unscheduledStudentsCount > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`flex items-center justify-between text-xs font-medium ${
                  result.unscheduledStudentsCount > 0 ? 'text-amber-700' : 'text-slate-600'
                }`}
              >
                <span>Chưa thể xếp</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="mt-2">
                <span
                  className={`text-2xl font-black ${
                    result.unscheduledStudentsCount > 0 ? 'text-amber-800' : 'text-slate-700'
                  }`}
                >
                  {result.unscheduledStudentsCount}
                </span>
                <span className="text-xs text-slate-500 ml-1">HS</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
              <div className="flex items-center justify-between text-indigo-700 text-xs font-medium">
                <span>Tỷ lệ đáp ứng</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-indigo-800">
                  {result.satisfactionRate}%
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-violet-50 border border-violet-200">
              <div className="flex items-center justify-between text-violet-700 text-xs font-medium">
                <span>Số ca đã phân bổ</span>
                <CalendarCheck className="w-4 h-4" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-violet-800">
                  {result.totalSessionsScheduled}
                </span>
                <span className="text-xs text-violet-600 ml-1">buổi</span>
              </div>
            </div>
          </div>

          {/* Unassigned Diagnostic Section (CRITICAL REQUIREMENT) */}
          {result.unassignedStudents.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Chi Tiết Học Sinh Chưa Thể Xếp & Đề Xuất Xử Lý ({result.unassignedStudents.length} học sinh)</span>
              </div>

              <div className="space-y-3">
                {result.unassignedStudents.map((diag) => (
                  <div
                    key={diag.studentId}
                    className="rounded-lg bg-white p-3.5 border border-amber-200 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-bold text-slate-800 text-sm">
                          Chưa thể xếp lịch cho {diag.studentName}
                        </span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {diag.groupName}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Số ca rảnh đã gửi: <b>{diag.availableSlotsCount}</b> (Ưu tiên: {diag.preferredSlotsCount})
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Nguyên nhân */}
                      <div>
                        <p className="font-semibold text-rose-700 mb-1 flex items-center gap-1">
                          <span>• Nguyên nhân:</span>
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {diag.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Đề xuất xử lý */}
                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                        <p className="font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                          <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đề xuất xử lý:</span>
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-emerald-900">
                          {diag.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group Summaries */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-indigo-600" />
              <span>Phân Bổ Lịch Chi Tiết Từng Nhóm</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.groupSummaries.map((grp) => (
                <div
                  key={grp.groupId}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">{grp.groupName}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        grp.unmetSessions === 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {grp.unmetSessions === 0
                        ? `Đủ ${grp.sessions.length} buổi`
                        : `Thiếu ${grp.unmetSessions} buổi`}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {grp.sessions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Chưa xếp được ca nào phù hợp</p>
                    ) : (
                      grp.sessions.map((s, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-indigo-700">
                              {s.dayOfWeek === 'CN' ? 'Chủ Nhật' : `Thứ ${s.dayOfWeek}`}
                            </span>{' '}
                            <span className="text-slate-600 font-medium">({s.startTime} - {s.endTime})</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-600">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold">{s.studentCount} HS</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 pt-4 mt-2 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              id="btn-reschedule-partial-modal"
              onClick={() => onReschedule('partial')}
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              Xếp lại phần chưa phù hợp
            </button>
            <button
              id="btn-reschedule-full-modal"
              onClick={() => onReschedule('full')}
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              Xếp lại toàn bộ
            </button>
          </div>

          <div className="flex gap-2">
            <button
              id="btn-close-modal-bottom"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Đóng
            </button>
            <button
              id="btn-view-timetable-modal"
              onClick={() => {
                onClose();
                onViewSchedule();
              }}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>Xem Thời Khóa Biểu</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
