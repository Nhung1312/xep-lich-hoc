import React from 'react';
import { Calendar, UserCheck, Users, RotateCcw, Sparkles } from 'lucide-react';

interface Props {
  currentRole: 'teacher' | 'parent';
  onSelectRole: (role: 'teacher' | 'parent') => void;
  onResetSeed: () => void;
  onSwitchToReal?: () => void;
  isResetting: boolean;
}

export const Navbar: React.FC<Props> = ({
  currentRole,
  onSelectRole,
  onResetSeed,
  onSwitchToReal,
  isResetting,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-base sm:text-lg tracking-tight leading-tight">
              Xếp Lịch Học Tự Động
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Hệ thống tối ưu hóa thời khóa biểu dành cho giáo viên dạy nhiều nhóm
            </p>
          </div>
        </div>

        {/* Role Switcher & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Segmented Control for Roles */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              id="role-btn-teacher"
              onClick={() => onSelectRole('teacher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentRole === 'teacher'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Giáo viên</span>
            </button>

            <button
              id="role-btn-parent"
              onClick={() => onSelectRole('parent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentRole === 'parent'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Phụ huynh</span>
            </button>
          </div>

          {/* Quick Reset Demo Seed */}
          <button
            id="btn-reset-seed"
            onClick={onResetSeed}
            disabled={isResetting}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 transition-colors"
            title="Khôi phục lại dữ liệu mẫu để thử nghiệm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Dữ liệu mẫu</span>
          </button>

          {/* Switch to Real Mode */}
          {onSwitchToReal && (
            <button
              id="btn-real-mode"
              onClick={onSwitchToReal}
              disabled={isResetting}
              className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Khởi tạo không gian làm việc trống cho học sinh thực tế"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse hidden sm:inline-block" />
              <span className="hidden sm:inline">Tạo lớp thực tế</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
