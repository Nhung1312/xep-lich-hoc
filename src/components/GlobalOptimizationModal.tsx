import React, { useEffect, useState } from 'react';
import { GlobalOptimizationProposal } from '../types.ts';
import { api } from '../api.ts';
import {
  Compass,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  X,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onApplyGlobalProposal?: () => Promise<void>;
}

export const GlobalOptimizationModal: React.FC<Props> = ({ onClose, onApplyGlobalProposal }) => {
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<GlobalOptimizationProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchProposal();
  }, []);

  const fetchProposal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getGlobalOptimizationProposal();
      setProposal(res.proposal);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi phân tích tối ưu toàn bộ';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!onApplyGlobalProposal) return;
    setApplying(true);
    try {
      await onApplyGlobalProposal();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Áp dụng phương án tối ưu thất bại');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-violet-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-violet-600 text-white shadow-xs">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Phân Tích Toàn Bộ Lịch Học (Global Analysis)
              </h3>
              <p className="text-xs text-slate-500">
                Hệ thống tìm kiếm phương án hoán đổi giữa các nhóm để tăng số học sinh được đáp ứng
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

        {/* Body */}
        <div className="p-6 space-y-5">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
              <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Đang rà soát và mô phỏng tổ hợp chéo giữa các nhóm học sinh...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && proposal && (
            <div className="space-y-4">
              {/* Comparison Summary Card */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">HIỆN TẠI</span>
                  <div className="text-xl font-black text-slate-800 mt-0.5">
                    {proposal.currentSatisfiedStudents} / {proposal.totalStudents}
                  </div>
                  <span className="text-[10px] text-slate-400">học sinh được đáp ứng đủ buổi</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-violet-700 block flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>ĐỀ XUẤT TỐI ƯU</span>
                  </span>
                  <div className="text-xl font-black text-violet-700 mt-0.5">
                    {proposal.potentialSatisfiedStudents} / {proposal.totalStudents}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {proposal.potentialSatisfiedStudents > proposal.currentSatisfiedStudents
                      ? `+${proposal.potentialSatisfiedStudents - proposal.currentSatisfiedStudents} học sinh được tham gia!`
                      : 'Đã đạt điểm cao nhất'}
                  </span>
                </div>
              </div>

              {/* Status Note */}
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  proposal.hasBetterPlan
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <div className="font-bold">{proposal.improvementNote}</div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Ứng dụng không tự ý áp dụng. Giáo viên hoàn toàn chủ động quyết định.
                  </p>
                </div>
              </div>

              {/* Proposed Swaps List */}
              {proposal.proposedChanges.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 block">
                    Chi tiết các thay đổi đề xuất:
                  </span>

                  {proposal.proposedChanges.map((change, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{change.groupName}</span>
                        <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                          {change.reason}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="p-1.5 rounded-md bg-slate-100 text-slate-600">
                          {change.fromSessions.join(', ') || 'Chưa xếp'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-violet-600 shrink-0" />
                        <span className="p-1.5 rounded-md bg-violet-100 text-violet-800 font-bold">
                          {change.toSessions.join(', ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white"
          >
            Đóng
          </button>

          {proposal?.hasBetterPlan && onApplyGlobalProposal && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{applying ? 'Đang áp dụng...' : 'ÁP DỤNG PHƯƠNG ÁN TỐI ƯU'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
