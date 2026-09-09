import React, { useState } from 'react';
import {
  Group,
  Student,
  ScheduleSession,
  TeacherConfig,
  DAYS_CONFIG,
  SLOTS_CONFIG,
  DayKey,
  SlotKey,
  ImpactAnalysisResult,
  getSlotLabel,
  getSlotTimeDisplay,
} from '../types.ts';
import { api } from '../api.ts';
import {
  X,
  Plus,
  Trash2,
  Check,
  Clock,
  Calendar,
  Users,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  group: Group | null;
  students: Student[];
  schedules: ScheduleSession[];
  teacherConfig: TeacherConfig;
  onClose: () => void;
  onSaved: () => void;
  onReanalyzeGroup?: (groupId: string) => void;
}

export const ManualEditSessionModal: React.FC<Props> = ({
  group,
  students,
  schedules,
  teacherConfig,
  onClose,
  onSaved,
  onReanalyzeGroup,
}) => {
  if (!group) return null;

  const groupStudents = students.filter((s) => s.groupId === group.id);
  const initialGroupSessions = schedules.filter((s) => s.groupId === group.id);

  const [localSessions, setLocalSessions] = useState<ScheduleSession[]>(initialGroupSessions);
  const [newDay, setNewDay] = useState<DayKey>('2');
  const [newSlot, setNewSlot] = useState<SlotKey>('ct');
  const [saving, setSaving] = useState(false);

  // Impact Check State (Section 14)
  const [checkingImpact, setCheckingImpact] = useState(false);
  const [impactResult, setImpactResult] = useState<ImpactAnalysisResult | null>(null);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);

  const handleRunImpactCheck = async (fromSessionId: string, toDay: DayKey, toSlot: SlotKey) => {
    setCheckingImpact(true);
    setTargetSessionId(fromSessionId);
    try {
      const res = await api.checkSessionImpact({
        groupId: group.id,
        fromSessionId,
        toDay,
        toSlot,
      });
      setImpactResult(res.impact);
    } catch (err) {
      console.error(err);
      alert('Kiểm tra ảnh hưởng thất bại');
    } finally {
      setCheckingImpact(false);
    }
  };

  const handleChangeSessionSlot = (sessionId: string, newD: DayKey, newS: SlotKey) => {
    const timeInfo = getSlotTimeDisplay(newD, newS, teacherConfig);
    setLocalSessions(
      localSessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        return {
          ...sess,
          dayOfWeek: newD,
          slot: newS,
          startTime: timeInfo.startTime,
          endTime: timeInfo.endTime,
        };
      })
    );
    // automatically trigger impact check to give feedback
    handleRunImpactCheck(sessionId, newD, newS);
  };

  const handleRemoveSession = (sessionId: string) => {
    setLocalSessions(localSessions.filter((s) => s.id !== sessionId));
    setImpactResult(null);
  };

  const handleAddSession = () => {
    const timeInfo = getSlotTimeDisplay(newDay, newSlot, teacherConfig);

    // Check if slot already exists in this group
    if (localSessions.some((s) => s.dayOfWeek === newDay && s.slot === newSlot)) {
      alert('Ca này đã tồn tại trong nhóm');
      return;
    }

    const newSess: ScheduleSession = {
      id: `sess_manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      groupId: group.id,
      dayOfWeek: newDay,
      slot: newSlot,
      startTime: timeInfo.startTime,
      endTime: timeInfo.endTime,
      isLocked: false,
      status: 'tentative',
      studentIds: groupStudents.map((s) => s.id),
    };

    setLocalSessions([...localSessions, newSess]);
    handleRunImpactCheck(newSess.id, newDay, newSlot);
  };

  const handleToggleStudent = (sessionId: string, studentId: string) => {
    setLocalSessions(
      localSessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const exists = sess.studentIds.includes(studentId);
        return {
          ...sess,
          studentIds: exists
            ? sess.studentIds.filter((id) => id !== studentId)
            : [...sess.studentIds, studentId],
        };
      })
    );
  };

  const isLocked = group.isLocked || group.status === 'locked';

  const handleSave = async () => {
    if (isLocked) {
      alert('Nhóm này đang bị KHÓA lịch chính thức (LOCKED). Bạn cần mở khóa nhóm trước khi lưu thay đổi.');
      return;
    }

    if (impactResult && impactResult.teacherConflict) {
      alert(`Không thể lưu lịch do có xung đột giáo viên: ${impactResult.teacherConflict}. Vui lòng chọn ca khác hoặc đổi phương án.`);
      return;
    }

    setSaving(true);
    try {
      const otherSessions = schedules.filter((s) => s.groupId !== group.id);
      const updatedSchedules = [...otherSessions, ...localSessions];
      await api.saveManualSchedules(updatedSchedules);
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Lưu lịch thất bại';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="manual-edit-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl my-6 rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                Chỉnh Sửa Lịch Nhóm: {group.name}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Lịch dự kiến
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Yêu cầu: <b>{group.sessionsPerWeek} buổi / tuần</b> • Bạn có thể chuyển đổi ca hoặc chọn lại phương án
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onReanalyzeGroup && (
              <button
                onClick={() => {
                  onClose();
                  onReanalyzeGroup(group.id);
                }}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Xem lại các phương án tổ hợp</span>
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-4 space-y-5">
          {/* Section 14 & Requirement 9: Conflict & Impact Analysis Feedback Box */}
          {impactResult && (!impactResult.canApply || impactResult.affectedGroups.length > 0 || impactResult.teacherConflict) ? (
            <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/90 text-amber-950 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs text-amber-900 uppercase">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>⚠️ THAY ĐỔI TẠO XUNG ĐỘT</span>
                </div>
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-200 text-amber-900">
                  Cần điều chỉnh
                </span>
              </div>

              <div className="text-xs text-amber-900 space-y-1.5">
                {impactResult.teacherConflict && (
                  <p className="font-semibold text-rose-800">
                    • {impactResult.teacherConflict}
                  </p>
                )}
                {impactResult.affectedGroups.map((g, idx) => (
                  <p key={idx} className="font-medium">
                    • Nhóm <b>{g.groupName}</b> đang sử dụng ca này ({g.reason}). Hệ thống không tự ý thay đổi nhóm {g.groupName}.
                  </p>
                ))}
                {impactResult.studentConflicts.length > 0 && (
                  <p className="text-rose-800 font-medium">
                    • Trùng lịch học sinh: {impactResult.studentConflicts.map((c) => `${c.studentName} trùng lịch với nhóm ${c.conflictWithGroup}`).join(', ')}
                  </p>
                )}
                <div className="text-[11px] text-slate-600 pt-1">
                  Độ hài lòng: {impactResult.satisfiedCount}/{impactResult.totalStudents} học sinh nhóm {group.name} có thể học ca này.
                </div>
              </div>

              {/* Requirement 9: 3 Explicit Teacher Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setLocalSessions(initialGroupSessions);
                    setImpactResult(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs"
                >
                  [HỦY THAO TÁC]
                </button>

                {onReanalyzeGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onReanalyzeGroup(group.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>[ĐỔI PHƯƠNG ÁN CHO {group.name}]</span>
                  </button>
                )}

                {impactResult.affectedGroups.length > 0 && onReanalyzeGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      const otherGroupId = impactResult.affectedGroups[0].groupId;
                      onClose();
                      onReanalyzeGroup(otherGroupId);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs"
                  >
                    [XEM PHƯƠNG ÁN KHÁC CHO {impactResult.affectedGroups[0].groupName}]
                  </button>
                )}
              </div>
            </div>
          ) : impactResult ? (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-950 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>KIỂM TRA ẢNH HƯỞNG: Ca học hợp lệ, không gây xung đột</span>
                </div>
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                  Có thể áp dụng
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium">
                <div>✓ {impactResult.satisfiedCount}/{impactResult.totalStudents} học sinh phù hợp ca mới</div>
                <div>✓ Không trùng ca giáo viên và nhóm khác</div>
              </div>
            </div>
          ) : null}

          {/* Current Sessions List with in-place adjustment */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Các ca đang xếp cho nhóm ({localSessions.length} ca):
            </h4>

            {localSessions.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl text-center">
                Chưa có ca nào được xếp cho nhóm này. Hãy bấm Thêm ca hoặc Xem lại các phương án tổ hợp.
              </p>
            ) : (
              localSessions.map((sess, idx) => {
                const dayObj = DAYS_CONFIG.find((d) => d.key === sess.dayOfWeek);

                return (
                  <div
                    key={sess.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {dayObj?.fullLabel} ({dayObj?.label}) - {getSlotLabel(sess.slot)}
                        </span>
                        <span className="text-xs font-mono text-indigo-700 font-semibold bg-indigo-50/70 px-2 py-0.5 rounded-md">
                          {sess.startTime} - {sess.endTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Change day dropdown */}
                        <select
                          value={sess.dayOfWeek}
                          onChange={(e) =>
                            handleChangeSessionSlot(sess.id, e.target.value as DayKey, sess.slot)
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                        >
                          {DAYS_CONFIG.map((d) => (
                            <option key={d.key} value={d.key}>
                              {d.label}
                            </option>
                          ))}
                        </select>

                        {/* Change slot dropdown */}
                        <select
                          value={sess.slot}
                          onChange={(e) =>
                            handleChangeSessionSlot(sess.id, sess.dayOfWeek, e.target.value as SlotKey)
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                        >
                          {SLOTS_CONFIG.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleRemoveSession(sess.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          title="Xóa ca này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Students participating in this session */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-xs font-semibold text-slate-700 mb-1.5 block">
                        Học sinh tham gia ca này ({sess.studentIds.length}/{group.maxStudents} HS):
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {groupStudents.map((st) => {
                          const isEnrolled = sess.studentIds.includes(st.id);
                          return (
                            <label
                              key={st.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isEnrolled
                                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-medium'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isEnrolled}
                                onChange={() => handleToggleStudent(sess.id, st.id)}
                                className="rounded-sm text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="truncate">{st.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Session Bar */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <span className="text-xs font-bold text-slate-800">Thêm một buổi học khác:</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newDay}
                onChange={(e) => setNewDay(e.target.value as DayKey)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
              >
                {DAYS_CONFIG.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.fullLabel} ({d.label})
                  </option>
                ))}
              </select>

              <select
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value as SlotKey)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
              >
                {SLOTS_CONFIG.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleAddSession}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm ca & Kiểm tra ảnh hưởng</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isLocked}
            className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs ${
              isLocked
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : isLocked ? 'NHÓM ĐÃ KHÓA' : 'LƯU LỊCH NHÓM'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
