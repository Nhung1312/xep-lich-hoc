import React, { useEffect, useState } from 'react';
import {
  Group,
  ScheduleCombinationOption,
  DAYS_CONFIG,
  SLOTS_CONFIG,
  getSlotLabel,
} from '../types.ts';
import { api } from '../api.ts';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Star,
  Users,
  Calendar,
  X,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Props {
  group: Group;
  onClose: () => void;
  onSelectOption: (option: ScheduleCombinationOption) => Promise<void>;
}

export const GroupAnalyzeModal: React.FC<Props> = ({ group, onClose, onSelectOption }) => {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<ScheduleCombinationOption[]>([]);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCombinations();
  }, [group.id]);

  const loadCombinations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyzeGroupCombinations(group.id);
      setOptions(res.options || []);
      if (res.options && res.options.length > 0) {
        setExpandedOptionId(res.options[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể phân tích tổ hợp ca';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isGroupLocked = group.isLocked || group.status === 'locked';

  const handleSelect = async (opt: ScheduleCombinationOption) => {
    if (isGroupLocked) {
      alert('Nhóm này đã được khóa lịch chính thức (LOCKED). Bạn cần mở khóa nhóm trước khi chọn lại phương án.');
      return;
    }

    if (opt.hasTeacherConflict) {
      alert(`Không thể chọn: Phương án này có ca trùng với lịch giáo viên của nhóm khác (${opt.teacherConflictNote || 'trùng lịch'}).`);
      return;
    }

    setSelectingId(opt.id);
    try {
      await onSelectOption(opt);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Không thể lưu phương án đã chọn';
      alert(msg);
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Phân Tích & Đề Xuất Lịch: {group.name}
              </h3>
              <p className="text-xs text-slate-500">
                Yêu cầu: <b>{group.sessionsPerWeek} buổi / tuần</b> • Hệ thống phân tích tổ hợp ca đồng thời
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Đang tính toán các tổ hợp ca tối ưu cho toàn bộ học sinh...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && options.length === 0 && (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">Không tìm thấy phương án hoàn hảo</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hiện tại các ca của nhóm đang bị trùng với lịch giáo viên đã xếp cho nhóm khác, hoặc học sinh chưa gửi đủ ca rảnh chung. Vui lòng kiểm tra lại cài đặt ca hoặc lịch rảnh của học sinh.
              </p>
            </div>
          )}

          {!loading && !error && options.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Hệ thống tìm thấy <b>{options.length} phương án tổ hợp ca khả thi</b>:</span>
                <span>Giáo viên là người quyết định chọn phương án</span>
              </div>

              {options.map((opt, idx) => {
                const isFirst = idx === 0;
                const isExpanded = expandedOptionId === opt.id;
                const isSelecting = selectingId === opt.id;

                return (
                  <div
                    key={opt.id}
                    className={`rounded-xl border transition-all ${
                      isFirst
                        ? 'border-indigo-300 bg-indigo-50/20 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Option Header */}
                    <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                            isFirst
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isFirst && <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />}
                          <span>PHƯƠNG ÁN {idx + 1}</span>
                          {isFirst && <span className="text-[10px] font-bold text-amber-700 ml-1">ĐỀ XUẤT ⭐</span>}
                        </span>

                        {/* Match metrics badges */}
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            opt.satisfactionCount === opt.totalStudents
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {opt.satisfactionCount}/{opt.totalStudents} học sinh phù hợp (✓ {group.sessionsPerWeek}/{group.sessionsPerWeek} buổi)
                        </span>

                        {opt.preferredCount > 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>{opt.preferredCount} HS ưu tiên</span>
                          </span>
                        )}
                      </div>

                      {/* Select Button */}
                      <button
                        onClick={() => handleSelect(opt)}
                        disabled={isSelecting || isGroupLocked || opt.hasTeacherConflict}
                        title={
                          isGroupLocked
                            ? 'Nhóm đã khóa lịch chính thức, cần mở khóa trước'
                            : opt.hasTeacherConflict
                            ? 'Trùng ca dạy giáo viên với nhóm khác'
                            : 'Chọn phương án này làm Lịch dự kiến'
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                          isGroupLocked || opt.hasTeacherConflict
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                            : isFirst
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>
                          {isSelecting
                            ? 'Đang chọn...'
                            : isGroupLocked
                            ? 'NHÓM ĐÃ KHÓA'
                            : opt.hasTeacherConflict
                            ? 'TRÙNG LỊCH GV'
                            : 'CHỌN PHƯƠNG ÁN NÀY'}
                        </span>
                      </button>
                    </div>

                    {/* Sessions details */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {opt.sessions.map((sess, sIdx) => {
                          const dayObj = DAYS_CONFIG.find((d) => d.key === sess.dayOfWeek);
                          const slotLabel = getSlotLabel(sess.slot);

                          return (
                            <div
                              key={sIdx}
                              className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-slate-800">
                                  {dayObj?.fullLabel} ({dayObj?.label}) - {slotLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-500 font-mono">
                                <Clock className="w-3 h-3" />
                                <span>{sess.startTime} - {sess.endTime}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Teacher or student conflict alert */}
                      {opt.hasTeacherConflict && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{opt.teacherConflictNote || 'Có xung đột lịch ca dạy với nhóm khác'}</span>
                        </div>
                      )}

                      {/* Toggle student breakdown details */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedOptionId(isExpanded ? null : opt.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Thu gọn chi tiết học sinh' : 'Xem chi tiết học sinh tham gia'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-3 text-xs border-t border-slate-100 pt-3">
                            {/* Category 1: Phù hợp toàn bộ lịch */}
                            <div>
                              <div className="font-semibold text-emerald-800 flex items-center justify-between mb-1.5">
                                <span>1. Học sinh phù hợp toàn bộ lịch ({opt.fullyMatchingStudents?.length ?? opt.attendingStudents.length}):</span>
                                <span className="text-[10px] text-emerald-600 font-normal">Được xếp vào ca học</span>
                              </div>
                              {(opt.fullyMatchingStudents || opt.attendingStudents).length === 0 ? (
                                <p className="text-slate-400 italic">Không có học sinh nào phù hợp toàn bộ các buổi.</p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {(opt.fullyMatchingStudents || opt.attendingStudents).map((st) => (
                                    <div
                                      key={st.id}
                                      className="flex items-center justify-between p-1.5 px-2.5 rounded-md bg-emerald-50/70 border border-emerald-200 text-emerald-900"
                                    >
                                      <span className="font-medium">{st.name}</span>
                                      <div className="flex items-center gap-1">
                                        {st.isPreferred && <Star className="w-3 h-3 fill-amber-500 text-amber-500" />}
                                        <span className="text-[10px] font-bold text-emerald-700">✓ Đầy đủ {group.sessionsPerWeek}/{group.sessionsPerWeek}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Category 2: Học sinh không phù hợp / bận ca */}
                            {((opt.unavailableStudents && opt.unavailableStudents.length > 0) ||
                              (!opt.unavailableStudents && opt.unattendingStudents.filter((s) => !s.reason.includes('Trùng lịch') && !s.reason.includes('Chưa gửi')).length > 0)) && (
                              <div>
                                <div className="font-semibold text-amber-800 flex items-center justify-between mb-1.5">
                                  <span>2. Học sinh không phù hợp / bận ca ({(opt.unavailableStudents || opt.unattendingStudents.filter((s) => !s.reason.includes('Trùng lịch') && !s.reason.includes('Chưa gửi'))).length}):</span>
                                  <span className="text-[10px] text-amber-600 font-normal">Bận hoặc không rảnh ca này</span>
                                </div>
                                <div className="space-y-1">
                                  {(opt.unavailableStudents || opt.unattendingStudents.filter((s) => !s.reason.includes('Trùng lịch') && !s.reason.includes('Chưa gửi'))).map((st) => (
                                    <div
                                      key={st.id}
                                      className="flex items-center justify-between p-1.5 px-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900"
                                    >
                                      <span className="font-medium">{st.name}</span>
                                      <span className="text-[10px] text-amber-700 font-medium">{st.reason}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Category 3: Trùng lịch với nhóm khác */}
                            {((opt.conflictStudents && opt.conflictStudents.length > 0) ||
                              (!opt.conflictStudents && opt.unattendingStudents.filter((s) => s.reason.includes('Trùng lịch')).length > 0)) && (
                              <div>
                                <div className="font-semibold text-rose-800 flex items-center justify-between mb-1.5">
                                  <span>3. Học sinh bị trùng lịch nhóm khác ({(opt.conflictStudents || opt.unattendingStudents.filter((s) => s.reason.includes('Trùng lịch'))).length}):</span>
                                  <span className="text-[10px] text-rose-600 font-normal">Đã có ca ở nhóm khác cùng giờ</span>
                                </div>
                                <div className="space-y-1">
                                  {(opt.conflictStudents || opt.unattendingStudents.filter((s) => s.reason.includes('Trùng lịch'))).map((st) => (
                                    <div
                                      key={st.id}
                                      className="flex items-center justify-between p-1.5 px-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900"
                                    >
                                      <span className="font-medium">{st.name}</span>
                                      <span className="text-[10px] text-rose-700 font-medium">{st.reason}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Category 4: Chưa gửi lịch */}
                            {((opt.notSubmittedStudents && opt.notSubmittedStudents.length > 0) ||
                              (!opt.notSubmittedStudents && opt.unattendingStudents.filter((s) => s.reason.includes('Chưa gửi')).length > 0)) && (
                              <div>
                                <div className="font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                                  <span>4. Học sinh chưa gửi lịch rảnh ({(opt.notSubmittedStudents || opt.unattendingStudents.filter((s) => s.reason.includes('Chưa gửi'))).length}):</span>
                                  <span className="text-[10px] text-slate-500 font-normal">Chưa có thông tin khảo sát</span>
                                </div>
                                <div className="space-y-1">
                                  {(opt.notSubmittedStudents || opt.unattendingStudents.filter((s) => s.reason.includes('Chưa gửi'))).map((st) => (
                                    <div
                                      key={st.id}
                                      className="flex items-center justify-between p-1.5 px-2.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700"
                                    >
                                      <span className="font-medium">{st.name}</span>
                                      <span className="text-[10px] text-slate-500 italic">Chưa nộp lịch</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Sau khi bấm <b>[CHỌN PHƯƠNG ÁN NÀY]</b>, lịch sẽ trở thành <b>LỊCH DỰ KIẾN</b> và làm ràng buộc ca bận tạm thời cho các nhóm tiếp theo.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-white"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
