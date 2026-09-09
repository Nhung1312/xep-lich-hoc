import React, { useState } from 'react';
import { TeacherConfig, DAYS_CONFIG, SLOTS_CONFIG, DayKey, SlotKey, normalizeSlotKey } from '../types.ts';
import { Clock, Check, Save, Copy, Power, AlertCircle, Calendar } from 'lucide-react';

interface Props {
  teacherConfig: TeacherConfig;
  onSave: (config: TeacherConfig) => Promise<void>;
  onClose?: () => void;
}

export const SlotTimeSettings: React.FC<Props> = ({ teacherConfig, onSave, onClose }) => {
  // Mode: 'global' (áp dụng chung 5 ca) hoặc 'by_day' (tùy chỉnh từng ngày)
  const [viewMode, setViewMode] = useState<'global' | 'by_day'>('global');
  const [selectedDay, setSelectedDay] = useState<DayKey>('2');
  const [slotTimes, setSlotTimes] = useState(teacherConfig.slotTimes || {});

  // Global default template for the 5 ca
  const [globalSlots, setGlobalSlots] = useState<{
    [K in 'c1' | 'c2' | 'c3' | 'c4' | 'ct']: { startTime: string; endTime: string; enabled: boolean };
  }>(() => {
    return {
      c1: {
        startTime: teacherConfig.defaultSlotTimes?.c1?.startTime || '07:30',
        endTime: teacherConfig.defaultSlotTimes?.c1?.endTime || '09:00',
        enabled: teacherConfig.defaultSlotTimes?.c1?.enabled !== false,
      },
      c2: {
        startTime: teacherConfig.defaultSlotTimes?.c2?.startTime || '09:15',
        endTime: teacherConfig.defaultSlotTimes?.c2?.endTime || '10:45',
        enabled: teacherConfig.defaultSlotTimes?.c2?.enabled !== false,
      },
      c3: {
        startTime: teacherConfig.defaultSlotTimes?.c3?.startTime || '14:00',
        endTime: teacherConfig.defaultSlotTimes?.c3?.endTime || '15:30',
        enabled: teacherConfig.defaultSlotTimes?.c3?.enabled !== false,
      },
      c4: {
        startTime: teacherConfig.defaultSlotTimes?.c4?.startTime || '15:45',
        endTime: teacherConfig.defaultSlotTimes?.c4?.endTime || '17:15',
        enabled: teacherConfig.defaultSlotTimes?.c4?.enabled !== false,
      },
      ct: {
        startTime: teacherConfig.defaultSlotTimes?.ct?.startTime || '19:00',
        endTime: teacherConfig.defaultSlotTimes?.ct?.endTime || '20:30',
        enabled: teacherConfig.defaultSlotTimes?.ct?.enabled !== false,
      },
    };
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleGlobalChange = (
    slotId: 'c1' | 'c2' | 'c3' | 'c4' | 'ct',
    field: 'startTime' | 'endTime',
    val: string
  ) => {
    setGlobalSlots({
      ...globalSlots,
      [slotId]: {
        ...globalSlots[slotId],
        [field]: val,
      },
    });
  };

  const handleGlobalToggle = (slotId: 'c1' | 'c2' | 'c3' | 'c4' | 'ct') => {
    setGlobalSlots({
      ...globalSlots,
      [slotId]: {
        ...globalSlots[slotId],
        enabled: !globalSlots[slotId].enabled,
      },
    });
  };

  const handleApplyGlobalToAllDays = () => {
    const updated = { ...slotTimes };
    for (const day of DAYS_CONFIG) {
      for (const slot of SLOTS_CONFIG) {
        const g = globalSlots[slot.id];
        const key = `${day.key}_${slot.id}`;
        updated[key] = {
          startTime: g.startTime,
          endTime: g.endTime,
          enabled: g.enabled,
        };
        if (slot.legacyAlias) {
          updated[`${day.key}_${slot.legacyAlias}`] = {
            startTime: g.startTime,
            endTime: g.endTime,
            enabled: g.enabled,
          };
        }
      }
    }
    setSlotTimes(updated);
    alert('Đã đồng bộ khung giờ 5 ca áp dụng cho toàn bộ 7 ngày trong tuần!');
  };

  const handleDayTimeChange = (
    day: DayKey,
    slot: SlotKey,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    const norm = normalizeSlotKey(slot);
    const key = `${day}_${norm}`;
    const current = slotTimes[key] || {
      startTime: globalSlots[norm]?.startTime || '08:00',
      endTime: globalSlots[norm]?.endTime || '09:30',
      enabled: true,
    };

    setSlotTimes({
      ...slotTimes,
      [key]: {
        ...current,
        [field]: value,
      },
    });
  };

  const handleDayToggleSlot = (day: DayKey, slot: SlotKey) => {
    const norm = normalizeSlotKey(slot);
    const key = `${day}_${norm}`;
    const current = slotTimes[key] || {
      startTime: globalSlots[norm]?.startTime || '08:00',
      endTime: globalSlots[norm]?.endTime || '09:30',
      enabled: true,
    };

    setSlotTimes({
      ...slotTimes,
      [key]: {
        ...current,
        enabled: !current.enabled,
      },
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await onSave({
        ...teacherConfig,
        defaultSlotTimes: globalSlots,
        slotTimes,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Lưu cấu hình thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Cài Đặt Khung Giờ 5 Ca Học
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hệ thống 5 ca thống nhất: <b>CA 1, CA 2, CA 3, CA 4, CA TỐI</b>. Giáo viên chủ động định nghĩa khung giờ và bật/tắt khả năng dạy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
            >
              Đóng
            </button>
          )}
          <button
            id="btn-save-slot-settings"
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Đang lưu...' : saveSuccess ? 'Đã lưu thành công!' : 'Lưu cài đặt'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <button
          onClick={() => setViewMode('global')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            viewMode === 'global'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Khung Giờ Mẫu (Áp dụng chung 5 ca)
        </button>
        <button
          onClick={() => setViewMode('by_day')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            viewMode === 'by_day'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Chi Tiết Từng Ngày Trong Tuần (T2 - CN)
        </button>
      </div>

      {/* VIEW 1: GLOBAL 5 CA TEMPLATE (Section 2 & 3) */}
      {viewMode === 'global' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Cài đặt mẫu giờ cho 5 ca học chuẩn:
            </span>
            <button
              onClick={handleApplyGlobalToAllDays}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Đồng bộ khung giờ này cho cả 7 ngày</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {SLOTS_CONFIG.map((slot) => {
              const g = globalSlots[slot.id];
              const isEnabled = g.enabled;

              return (
                <div
                  key={slot.id}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-all ${
                    isEnabled
                      ? 'bg-white border-slate-200 shadow-2xs'
                      : 'bg-slate-50 border-dashed border-slate-300 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleGlobalToggle(slot.id)}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        isEnabled
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                      }`}
                      title={isEnabled ? 'Ca đang bật (Có thể dạy)' : 'Ca đang tắt (Giáo viên bận)'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{slot.label}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isEnabled ? 'Bật (Có thể dạy)' : 'Tắt (Giáo viên bận)'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">Khung giờ chuẩn: {slot.defaultStartTime} - {slot.defaultEndTime}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-medium">Bắt đầu:</span>
                      <input
                        type="time"
                        value={g.startTime}
                        disabled={!isEnabled}
                        onChange={(e) => handleGlobalChange(slot.id, 'startTime', e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-medium focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <span className="text-slate-400 font-bold">→</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-medium">Kết thúc:</span>
                      <input
                        type="time"
                        value={g.endTime}
                        disabled={!isEnabled}
                        onChange={(e) => handleGlobalChange(slot.id, 'endTime', e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-medium focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: BY DAY TABS (T2 - CN) */}
      {viewMode === 'by_day' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
            {DAYS_CONFIG.map((day) => {
              const isSelected = selectedDay === day.key;
              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDay(day.key)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {day.label} ({day.fullLabel})
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            <div className="text-xs text-slate-500 font-medium px-1">
              5 ca học ngày {DAYS_CONFIG.find((d) => d.key === selectedDay)?.fullLabel}:
            </div>

            {SLOTS_CONFIG.map((slot) => {
              const key = `${selectedDay}_${slot.id}`;
              const conf = slotTimes[key] || {
                startTime: globalSlots[slot.id]?.startTime || slot.defaultStartTime,
                endTime: globalSlots[slot.id]?.endTime || slot.defaultEndTime,
                enabled: globalSlots[slot.id]?.enabled !== false,
              };
              const isEnabled = conf.enabled !== false;

              return (
                <div
                  key={slot.id}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    isEnabled
                      ? 'bg-white border-slate-200 shadow-2xs'
                      : 'bg-slate-50 border-dashed border-slate-300 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDayToggleSlot(selectedDay, slot.id)}
                      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                        isEnabled
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <span>{slot.label}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isEnabled ? 'Có thể dạy' : 'Giáo viên bận'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="time"
                      value={conf.startTime}
                      disabled={!isEnabled}
                      onChange={(e) =>
                        handleDayTimeChange(selectedDay, slot.id, 'startTime', e.target.value)
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-slate-400 font-bold">→</span>
                    <input
                      type="time"
                      value={conf.endTime}
                      disabled={!isEnabled}
                      onChange={(e) =>
                        handleDayTimeChange(selectedDay, slot.id, 'endTime', e.target.value)
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Guide Note */}
      <div className="flex items-start gap-2 p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900">
        <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <span>
          Mọi nơi trong ứng dụng và cổng phụ huynh đều tự động cập nhật theo khung giờ ca học bạn cài đặt tại đây. Khi một ca bị tắt, thuật toán xếp lịch và phân tích tổ hợp ca sẽ tuyệt đối không xếp lớp vào ca đó.
        </span>
      </div>
    </div>
  );
};
