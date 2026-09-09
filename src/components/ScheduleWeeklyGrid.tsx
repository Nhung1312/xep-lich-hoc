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
} from '../types.ts';
import { Users, Lock, Unlock, Clock, AlertCircle } from 'lucide-react';

interface Props {
  groups: Group[];
  students: Student[];
  schedules: ScheduleSession[];
  teacherConfig: TeacherConfig;
  onToggleLockGroup?: (groupId: string, isLocked: boolean) => void;
  onEditSession?: (session: ScheduleSession) => void;
}

export const ScheduleWeeklyGrid: React.FC<Props> = ({
  groups,
  students,
  schedules,
  teacherConfig,
  onToggleLockGroup,
  onEditSession,
}) => {
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);

  const getSessionForSlot = (day: DayKey, slot: SlotKey): ScheduleSession | undefined => {
    return (schedules || []).find((s) => s.dayOfWeek === day && s.slot === slot);
  };

  const getTeacherSlotStatus = (day: DayKey, slot: SlotKey) => {
    const key = `${day}_${slot}`;
    const conf = teacherConfig?.slotTimes?.[key];
    const defaultStart = SLOTS_CONFIG.find((s) => s.id === slot)?.defaultStartTime || '08:00';
    const defaultEnd = SLOTS_CONFIG.find((s) => s.id === slot)?.defaultEndTime || '09:30';

    return {
      enabled: conf?.enabled !== false,
      startTime: conf?.startTime || defaultStart,
      endTime: conf?.endTime || defaultEnd,
    };
  };

  return (
    <div className="space-y-4">
      {/* Legend & Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-md bg-indigo-50 border border-indigo-300"></div>
            <span>Ca đã có lớp học</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300"></div>
            <span>Ca trống (khả dụng)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-md bg-amber-50 border border-dashed border-amber-300"></div>
            <span>Giáo viên bận (không dạy)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Lịch đã khóa cố định</span>
          </div>
        </div>
        <span className="text-slate-400 italic">Nhấn vào ô ca học để xem chi tiết học sinh</span>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3 px-3 w-32 font-bold text-xs text-slate-500 uppercase tracking-wider text-center border-r border-slate-200">
                Ca học
              </th>
              {DAYS_CONFIG.map((day) => (
                <th
                  key={day.key}
                  className="py-3 px-3 font-bold text-xs text-slate-700 text-center border-r border-slate-200 last:border-r-0"
                >
                  <div className="text-slate-900 font-bold text-sm">{day.label}</div>
                  <div className="text-[11px] text-slate-500 font-normal">{day.fullLabel}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {SLOTS_CONFIG.map((slot) => (
              <tr key={slot.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Row Header (Slot Name) */}
                <td className="p-3 bg-slate-50/70 border-r border-slate-200 text-center">
                  <div className="font-bold text-xs text-slate-800">{slot.label}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {slot.defaultStartTime} - {slot.defaultEndTime}
                  </div>
                </td>

                {/* Day Cells */}
                {DAYS_CONFIG.map((day) => {
                  const teacherSlot = getTeacherSlotStatus(day.key, slot.id);
                  const session = getSessionForSlot(day.key, slot.id);
                  const group = session ? (groups || []).find((g) => g.id === session.groupId) : null;

                  if (!teacherSlot.enabled) {
                    return (
                      <td
                        key={day.key}
                        className="p-2 border-r border-slate-200 last:border-r-0 bg-slate-50/80 align-top"
                      >
                        <div className="min-h-[86px] rounded-lg border border-dashed border-slate-300 p-2 flex flex-col items-center justify-center text-slate-400 text-center">
                          <span className="text-[10px] font-medium">Giáo viên bận</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">
                            {teacherSlot.startTime} - {teacherSlot.endTime}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  if (session && group) {
                    const isLocked = group.isLocked || session.isLocked;
                    return (
                      <td
                        key={day.key}
                        className="p-1.5 border-r border-slate-200 last:border-r-0 align-top"
                      >
                        <div
                          onClick={() => {
                            setSelectedSession(session);
                            if (onEditSession) onEditSession(session);
                          }}
                          className={`min-h-[86px] rounded-xl p-2.5 cursor-pointer transition-all flex flex-col justify-between border ${
                            isLocked
                              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400 shadow-xs'
                              : 'bg-indigo-50/80 border-indigo-200 hover:border-indigo-400 shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <span
                                className={`text-xs font-bold leading-snug line-clamp-1 ${
                                  isLocked ? 'text-amber-900' : 'text-indigo-900'
                                }`}
                              >
                                {group.name}
                              </span>
                              {isLocked ? (
                                <Lock className="w-3 h-3 text-amber-700 shrink-0 mt-0.5" />
                              ) : (
                                <Unlock className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              {group.subject} • {group.grade}
                            </div>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-500" />
                              {session.studentIds.length}/{group.maxStudents} HS
                            </span>
                            <span className="font-mono text-slate-500">
                              {session.startTime}-{session.endTime}
                            </span>
                          </div>
                        </div>
                      </td>
                    );
                  }

                  // Empty Slot
                  return (
                    <td
                      key={day.key}
                      className="p-1.5 border-r border-slate-200 last:border-r-0 align-top"
                    >
                      <div className="min-h-[86px] rounded-xl border border-slate-100 hover:border-slate-300 bg-slate-50/30 p-2 flex flex-col justify-between text-slate-400 group transition-all">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {teacherSlot.startTime} - {teacherSlot.endTime}
                        </span>
                        <span className="text-[11px] text-slate-300 group-hover:text-slate-500 transition-colors text-center">
                          (Trống)
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div
          id="session-detail-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSession(null);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-xl border border-slate-100">
            {(() => {
              const grp = (groups || []).find((g) => g.id === selectedSession.groupId);
              const enrolledStudents = (students || []).filter((s) =>
                selectedSession.studentIds.includes(s.id)
              );
              const dayObj = DAYS_CONFIG.find((d) => d.key === selectedSession.dayOfWeek);
              const slotObj = SLOTS_CONFIG.find((s) => s.id === selectedSession.slot);

              return (
                <div>
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">
                        {grp?.name || 'Nhóm học'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dayObj?.fullLabel} • {slotObj?.label} ({selectedSession.startTime} - {selectedSession.endTime})
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="py-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600" />
                        Danh sách học sinh tham gia ({enrolledStudents.length}/{grp?.maxStudents} HS):
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {enrolledStudents.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2 text-center">
                          Chưa có học sinh nào được gán vào ca này
                        </p>
                      ) : (
                        enrolledStudents.map((st, idx) => (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                          >
                            <span className="font-medium text-slate-800">
                              {idx + 1}. {st.name}
                            </span>
                            {st.phone && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {st.phone}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {grp && onToggleLockGroup && (
                      <button
                        onClick={() => {
                          onToggleLockGroup(grp.id, !grp.isLocked);
                          setSelectedSession({
                            ...selectedSession,
                            isLocked: !grp.isLocked,
                          });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          grp.isLocked
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {grp.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        <span>{grp.isLocked ? 'Mở khóa nhóm' : 'Khóa lịch nhóm này'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedSession(null)}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
