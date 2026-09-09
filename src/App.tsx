import React, { useEffect, useState, useCallback } from 'react';
import {
  AppState,
  api,
} from './api.ts';
import {
  Group,
  Student,
  ScheduleSession,
  ScheduleCombinationOption,
  OptimizationResult,
} from './types.ts';
import { Navbar } from './components/Navbar.tsx';
import { StatsOverview } from './components/StatsOverview.tsx';
import { ScheduleWeeklyGrid } from './components/ScheduleWeeklyGrid.tsx';
import { ScheduleByGroup } from './components/ScheduleByGroup.tsx';
import { GroupManagement } from './components/GroupManagement.tsx';
import { SlotTimeSettings } from './components/SlotTimeSettings.tsx';
import { OptimizationResultModal } from './components/OptimizationResultModal.tsx';
import { GroupQRCodeModal } from './components/GroupQRCodeModal.tsx';
import { AutoGroupModal } from './components/AutoGroupModal.tsx';
import { ManualEditSessionModal } from './components/ManualEditSessionModal.tsx';
import { GroupAnalyzeModal } from './components/GroupAnalyzeModal.tsx';
import { GlobalOptimizationModal } from './components/GlobalOptimizationModal.tsx';
import { ParentPortal } from './components/ParentPortal.tsx';
import {
  Calendar,
  Layers,
  Users,
  Clock,
  Sparkles,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<'teacher' | 'parent'>('teacher');
  const [parentInitialCode, setParentInitialCode] = useState<string>('');

  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Teacher Tab
  const [teacherTab, setTeacherTab] = useState<'week_grid' | 'by_group' | 'groups_mgmt' | 'slot_settings'>('week_grid');

  // Modals
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [selectedGroupForQR, setSelectedGroupForQR] = useState<Group | null>(null);
  const [showAutoGroupModal, setShowAutoGroupModal] = useState(false);
  const [groupForManualEdit, setGroupForManualEdit] = useState<Group | null>(null);
  const [groupForAnalysis, setGroupForAnalysis] = useState<Group | null>(null);
  const [showGlobalOptModal, setShowGlobalOptModal] = useState(false);

  const [isScheduling, setIsScheduling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Check URL parameters on mount (e.g. ?portal=parent&code=TOAN8A26)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const portalParam = params.get('portal');
      const codeParam = params.get('code');

      if (portalParam === 'parent' || codeParam) {
        setRole('parent');
        if (codeParam) {
          setParentInitialCode(codeParam);
        }
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getState();
      setState(data);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      setError('Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Execute Auto-Scheduler
  const handleRunAutoSchedule = async (mode: 'full' | 'partial') => {
    setIsScheduling(true);
    try {
      await api.runAutoSchedule(mode);
      await loadData();
      setShowOptimizationModal(true);
    } catch (err) {
      console.error(err);
      alert('Chạy tự động xếp lịch thất bại');
    } finally {
      setIsScheduling(false);
    }
  };

  // Toggle Group Lock
  const handleToggleLockGroup = async (groupId: string, isLocked: boolean) => {
    try {
      await api.lockGroup(groupId, isLocked);
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Khóa/Mở khóa nhóm thất bại';
      alert(msg);
    }
  };

  // Confirm Group Schedule (Chuyển sang CONFIRMED)
  const handleConfirmGroup = async (groupId: string) => {
    try {
      await api.confirmGroupSchedule(groupId);
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Xác nhận chốt lịch nhóm thất bại';
      alert(msg);
    }
  };

  // Reset Group Schedule (Đặt lại nhóm về DRAFT)
  const handleResetGroup = async (groupId: string) => {
    if (!confirm('Bạn có chắc muốn đặt lại lịch nhóm này về trạng thái Chưa xếp? Toàn bộ ca học hiện tại của nhóm sẽ được xóa để xếp lại.')) {
      return;
    }
    try {
      await api.resetGroupSchedule(groupId);
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Đặt lại lịch nhóm thất bại';
      alert(msg);
    }
  };

  // Select Option from Combinatorial Analysis (Section 6 & 8)
  const handleSelectCombinationOption = async (option: ScheduleCombinationOption) => {
    if (!state || !groupForAnalysis) return;
    try {
      await api.selectGroupOption(groupForAnalysis.id, option);
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Lưu phương án đã chọn thất bại';
      alert(msg);
      throw err;
    }
  };

  // Apply Global Optimization Proposal (Section 16 - Explicit teacher approval)
  const handleApplyGlobalProposal = async () => {
    try {
      await api.applyOptimizationProposal();
      await loadData();
      setShowGlobalOptModal(false);
      alert('Đã áp dụng các đề xuất tối ưu cho các nhóm chưa chốt thành công!');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Áp dụng phương án tối ưu thất bại';
      alert(msg);
    }
  };

  // Reset Demo Seed Data
  const handleResetSeed = async () => {
    if (!confirm('Khôi phục toàn bộ dữ liệu mẫu ban đầu? Các thay đổi thử nghiệm trước đó sẽ được làm mới.')) {
      return;
    }
    setIsResetting(true);
    try {
      await api.resetToDemoSeed();
      await loadData();
      alert('Đã khôi phục dữ liệu mẫu thành công!');
    } catch (err) {
      console.error(err);
      alert('Khôi phục dữ liệu thất bại');
    } finally {
      setIsResetting(false);
    }
  };

  // Switch to Real Data Workspace
  const handleSwitchToReal = async () => {
    if (
      !confirm(
        'Chuyển sang chế độ Lớp học thực tế? Hệ thống sẽ tạo không gian làm việc mới (giữ lại cấu hình khung giờ dạy của thầy/cô) để bắt đầu tạo nhóm và mời phụ huynh gửi lịch.'
      )
    ) {
      return;
    }
    setIsResetting(true);
    try {
      await api.switchToRealMode();
      await loadData();
      alert('Đã sẵn sàng cho lớp học thực tế! Thầy/cô có thể tạo nhóm mới và gửi link/mã cho phụ huynh.');
    } catch (err) {
      console.error(err);
      alert('Chuyển chế độ thất bại');
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-700">Đang khởi động hệ thống xếp lịch...</p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-lg text-center max-w-md space-y-4">
          <p className="text-sm text-rose-600 font-medium">{error || 'Có lỗi xảy ra'}</p>
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  const unscheduledCount = state.lastOptimizationResult?.unscheduledStudentsCount || 0;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        currentRole={role}
        onSelectRole={setRole}
        onResetSeed={handleResetSeed}
        onSwitchToReal={handleSwitchToReal}
        isResetting={isResetting}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {role === 'parent' ? (
          /* PARENT PORTAL */
          <ParentPortal
            initialCode={parentInitialCode}
            onBackToTeacher={() => setRole('teacher')}
          />
        ) : (
          /* TEACHER DASHBOARD */
          <div className="space-y-6">
            {/* Dashboard Overview Metrics & 8 Analytics Cards */}
            <StatsOverview
              groups={state.groups}
              students={state.students}
              schedules={state.schedules}
              unscheduledCount={unscheduledCount}
              onAutoSchedule={handleRunAutoSchedule}
              onOpenSlotSettings={() => setTeacherTab('slot_settings')}
              onOpenAutoGroup={() => setShowAutoGroupModal(true)}
              onOpenGlobalAnalysis={() => setShowGlobalOptModal(true)}
              onSelectGroupToSchedule={(groupId) => {
                const grp = (state?.groups || []).find((g) => g.id === groupId);
                if (grp) setGroupForAnalysis(grp);
              }}
              isScheduling={isScheduling}
            />

            {/* View Optimization Results Banner if available */}
            {state.lastOptimizationResult && (
              <div className="bg-linear-to-r from-indigo-50 via-purple-50 to-white p-4 rounded-2xl border border-indigo-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Phương Án Tối Ưu Hiện Tại ({state.lastOptimizationResult.satisfactionRate}% Đáp Ứng)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Đã xếp <b>{state.lastOptimizationResult.scheduledStudentsCount}</b> HS • Còn{' '}
                      <b>{state.lastOptimizationResult.unscheduledStudentsCount}</b> HS chưa có lịch •{' '}
                      {state.lastOptimizationResult.totalSessionsScheduled} ca đã phân bổ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-open-opt-results"
                    onClick={() => setShowOptimizationModal(true)}
                    className="px-4 py-2 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                  >
                    <span>Xem chi tiết & Đề xuất xử lý</span>
                  </button>
                </div>
              </div>
            )}

            {/* Unassigned alert banner on main dashboard if any */}
            {unscheduledCount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-sm text-amber-950">
                      Có {unscheduledCount} học sinh chưa thể xếp lịch
                    </span>
                    <span className="text-amber-800">
                      Hệ thống đã phân tích nguyên nhân và đưa ra các đề xuất cụ thể (mở ca, tăng sĩ số, đề xuất phụ huynh chọn thêm ca).
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowOptimizationModal(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Xem đề xuất</span>
                </button>
              </div>
            )}

            {/* Teacher Sub-Navigation Tabs */}
            <div className="border-b border-slate-200 flex flex-wrap gap-2 pt-1">
              <button
                id="tab-week-grid"
                onClick={() => setTeacherTab('week_grid')}
                className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                  teacherTab === 'week_grid'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>B. Thời Khóa Biểu Tuần</span>
              </button>

              <button
                id="tab-by-group"
                onClick={() => setTeacherTab('by_group')}
                className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                  teacherTab === 'by_group'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>A. Lịch Theo Nhóm</span>
              </button>

              <button
                id="tab-groups-mgmt"
                onClick={() => setTeacherTab('groups_mgmt')}
                className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                  teacherTab === 'groups_mgmt'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Quản Lý Nhóm & Học Sinh</span>
              </button>

              <button
                id="tab-slot-settings"
                onClick={() => setTeacherTab('slot_settings')}
                className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                  teacherTab === 'slot_settings'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Cài Đặt Ca & Giờ Học</span>
              </button>
            </div>

            {/* Tab Views */}
            {teacherTab === 'week_grid' && (
              <ScheduleWeeklyGrid
                groups={state.groups}
                students={state.students}
                schedules={state.schedules}
                teacherConfig={state.teacherConfig}
                onToggleLockGroup={handleToggleLockGroup}
                onEditSession={(sess) => {
                  const grp = (state?.groups || []).find((g) => g.id === sess.groupId);
                  if (grp) setGroupForManualEdit(grp);
                }}
              />
            )}

            {teacherTab === 'by_group' && (
              <ScheduleByGroup
                groups={state.groups}
                students={state.students}
                schedules={state.schedules}
                onToggleLockGroup={handleToggleLockGroup}
                onConfirmGroup={handleConfirmGroup}
                onResetGroup={handleResetGroup}
                onOpenQR={(g) => setSelectedGroupForQR(g)}
                onManualEdit={(g) => setGroupForManualEdit(g)}
                onAnalyzeGroup={(g) => setGroupForAnalysis(g)}
              />
            )}

            {teacherTab === 'groups_mgmt' && (
              <GroupManagement
                groups={state.groups}
                students={state.students}
                schedules={state.schedules}
                availabilities={state.availabilities}
                onRefresh={loadData}
                onOpenQR={(g) => setSelectedGroupForQR(g)}
                onAnalyzeGroup={(g) => setGroupForAnalysis(g)}
                onEditGroup={(g) => setGroupForManualEdit(g)}
              />
            )}

            {teacherTab === 'slot_settings' && (
              <SlotTimeSettings
                teacherConfig={state.teacherConfig}
                onSave={async (newConfig) => {
                  await api.updateTeacherConfig(newConfig);
                  await loadData();
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      {showOptimizationModal && (
        <OptimizationResultModal
          result={state.lastOptimizationResult}
          onClose={() => setShowOptimizationModal(false)}
          onViewSchedule={() => setTeacherTab('week_grid')}
          onReschedule={(mode) => handleRunAutoSchedule(mode)}
        />
      )}

      {selectedGroupForQR && (
        <GroupQRCodeModal
          group={selectedGroupForQR}
          onClose={() => setSelectedGroupForQR(null)}
        />
      )}

      {showAutoGroupModal && (
        <AutoGroupModal
          onClose={() => setShowAutoGroupModal(false)}
          onGroupCreated={loadData}
        />
      )}

      {groupForManualEdit && (
        <ManualEditSessionModal
          group={groupForManualEdit}
          students={state.students}
          schedules={state.schedules}
          teacherConfig={state.teacherConfig}
          onClose={() => setGroupForManualEdit(null)}
          onSaved={loadData}
          onReanalyzeGroup={(groupId) => {
            const grp = (state?.groups || []).find((g) => g.id === groupId);
            if (grp) setGroupForAnalysis(grp);
          }}
        />
      )}

      {/* Group Combinatorial Candidate Analysis Modal */}
      {groupForAnalysis && (
        <GroupAnalyzeModal
          group={groupForAnalysis}
          onClose={() => setGroupForAnalysis(null)}
          onSelectOption={handleSelectCombinationOption}
        />
      )}

      {/* Global Optimization Analysis Modal */}
      {showGlobalOptModal && (
        <GlobalOptimizationModal
          onClose={() => setShowGlobalOptModal(false)}
          onApplyGlobalProposal={handleApplyGlobalProposal}
        />
      )}
    </div>
  );
}
