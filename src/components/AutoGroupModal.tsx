import React, { useEffect, useState } from 'react';
import { GroupSuggestion, DAYS_CONFIG, SLOTS_CONFIG } from '../types.ts';
import { api } from '../api.ts';
import { Users, Sparkles, Check, X, Clock, Calendar, ArrowRight } from 'lucide-react';

interface Props {
  onClose: () => void;
  onGroupCreated: () => void;
}

export const AutoGroupModal: React.FC<Props> = ({ onClose, onGroupCreated }) => {
  const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const res = await api.getGroupSuggestions();
      setSuggestions(res.suggestions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (sug: GroupSuggestion) => {
    setApplyingId(sug.id);
    try {
      await api.applyGroupSuggestion({
        suggestionId: sug.id,
        name: sug.suggestedName,
        subject: sug.subject,
        grade: sug.grade,
        dayOfWeek: sug.dayOfWeek,
        slot: sug.slot,
        studentIds: sug.studentIds,
      });
      alert(`Đã tạo thành công nhóm "${sug.suggestedName}" với ${sug.studentIds.length} học sinh!`);
      onGroupCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Tạo nhóm đề xuất thất bại');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div
      id="auto-group-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="auto-group-card"
        className="w-full max-w-2xl my-8 rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                Tự Động Ghép Học Sinh Vào Nhóm Mới
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Thuật toán tự động tìm các học sinh có nhiều khung giờ rảnh trùng nhau và đề xuất nhóm tối ưu.
              Giáo viên luôn là người phê duyệt cuối cùng.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto py-4 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Đang phân tích ma trận lịch rảnh của học sinh...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
              Chưa tìm thấy nhóm học sinh trùng lịch phù hợp để ghép nhóm mới.
              Bạn có thể khuyến khích thêm học sinh gửi lịch hoặc mở thêm ca dạy.
            </div>
          ) : (
            suggestions.map((sug) => {
              const dayObj = DAYS_CONFIG.find((d) => d.key === sug.dayOfWeek);
              const slotObj = SLOTS_CONFIG.find((s) => s.id === sug.slot);

              return (
                <div
                  key={sug.id}
                  className="rounded-xl border border-indigo-100 bg-slate-50/50 p-4 hover:border-indigo-300 hover:bg-white transition-all space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{sug.suggestedName}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-indigo-700">
                          <Calendar className="w-3.5 h-3.5" />
                          {dayObj?.fullLabel}
                        </span>
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {slotObj?.label} ({sug.startTime} - {sug.endTime})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApply(sug)}
                      disabled={applyingId === sug.id}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>{applyingId === sug.id ? 'Đang tạo...' : 'Xác nhận tạo nhóm'}</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Học sinh cùng rảnh khung giờ này ({sug.studentNames.length} HS):</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {sug.studentNames.map((name, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-xs font-medium shadow-2xs"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-100 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
