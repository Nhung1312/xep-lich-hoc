import React, { useEffect, useState } from 'react';
import {
  Group,
  TeacherConfig,
  DAYS_CONFIG,
  SLOTS_CONFIG,
  DayKey,
  SlotKey,
  AvailabilityStatus,
  normalizeSlotKey,
} from '../types.ts';
import { api } from '../api.ts';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Star,
  Check,
  X,
  AlertCircle,
  Lock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  initialCode?: string;
  onBackToTeacher?: () => void;
}

export const ParentPortal: React.FC<Props> = ({ initialCode = '', onBackToTeacher }) => {
  const [groupCodeInput, setGroupCodeInput] = useState(initialCode);
  const [groupData, setGroupData] = useState<{
    group: Group;
    teacherName: string;
    slotTimes: TeacherConfig['slotTimes'];
    defaultSlotTimes?: TeacherConfig['defaultSlotTimes'];
  } | null>(null);

  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Parent form state
  const [studentId, setStudentId] = useState<string | undefined>(undefined);
  const [parentToken, setParentToken] = useState<string | undefined>(undefined);
  const [studentName, setStudentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [availabilities, setAvailabilities] = useState<Record<string, AvailabilityStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const validatePhone = (phoneStr: string): boolean => {
    const clean = phoneStr.trim().replace(/[\s.-]/g, '');
    if (!clean) return false;
    const vnPhoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    const general10Digit = /^0[0-9]{9}$/;
    return vnPhoneRegex.test(clean) || general10Digit.test(clean);
  };

  useEffect(() => {
    if (initialCode) {
      handleLookupGroup(initialCode);
    }
  }, [initialCode]);

  const handleLookupGroup = async (codeToLookup: string) => {
    const cleanCode = codeToLookup.trim().toUpperCase();
    if (!cleanCode) return;
    setLoadingGroup(true);
    setGroupError(null);
    setSaveSuccess(false);

    try {
      const data = await api.getGroupByCode(cleanCode);
      setGroupData(data);

      // Check if this parent has previously submitted for this group in localStorage
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem(`parent_token_${cleanCode}`);
        const storedSid = localStorage.getItem(`student_id_${cleanCode}`);

        if (storedToken) {
          try {
            const existing = await api.getMySubmission(cleanCode, storedToken);
            if (existing && existing.student) {
              setStudentId(existing.student.id);
              setParentToken(storedToken);
              setStudentName(existing.student.name || '');
              setParentPhone(existing.student.phone || '');
              if (existing.availability?.availabilities) {
                setAvailabilities(existing.availability.availabilities);
              }
              setIsEditingExisting(true);
            }
          } catch {
            // Token expired or invalid, keep storedSid if present
            if (storedSid) setStudentId(storedSid);
          }
        } else if (storedSid) {
          setStudentId(storedSid);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Không tìm thấy nhóm học';
      setGroupError(errorMsg);
      setGroupData(null);
    } finally {
      setLoadingGroup(false);
    }
  };

  // Toggle cell availability on click: unavailable -> available -> preferred -> unavailable
  const handleCellClick = (day: DayKey, slot: SlotKey) => {
    if (groupData?.group.isLocked) return;

    const norm = normalizeSlotKey(slot);
    const key = `${day}_${norm}`;
    const current = availabilities[key] || 'unavailable';

    let next: AvailabilityStatus;
    if (current === 'unavailable') {
      next = 'available';
    } else if (current === 'available') {
      next = 'preferred';
    } else {
      next = 'unavailable';
    }

    setAvailabilities({
      ...availabilities,
      [key]: next,
    });
  };

  const handleQuickSelect = (type: 'all_evening' | 'all_c3_c4' | 'clear') => {
    if (groupData?.group.isLocked) return;

    const nextAvail = { ...availabilities };

    if (type === 'clear') {
      setAvailabilities({});
      return;
    }

    for (const d of DAYS_CONFIG) {
      if (type === 'all_evening') {
        nextAvail[`${d.key}_ct`] = 'available';
      } else if (type === 'all_c3_c4') {
        nextAvail[`${d.key}_c3`] = 'available';
        nextAvail[`${d.key}_c4`] = 'available';
      }
    }

    setAvailabilities(nextAvail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupData) return;

    if (!studentName.trim()) {
      alert('Vui lòng nhập họ và tên học sinh.');
      return;
    }

    if (!parentPhone.trim()) {
      setPhoneError('Vui lòng nhập số điện thoại phụ huynh.');
      alert('Vui lòng nhập số điện thoại phụ huynh.');
      return;
    }

    if (!validatePhone(parentPhone)) {
      setPhoneError('Số điện thoại phụ huynh không hợp lệ. Vui lòng nhập số điện thoại gồm 10 chữ số (VD: 0912345678).');
      alert('Số điện thoại phụ huynh không hợp lệ. Vui lòng nhập số điện thoại gồm 10 chữ số (VD: 0912345678).');
      return;
    }
    setPhoneError(null);

    // Count selected available/preferred slots
    const selectedCount = Object.values(availabilities).filter(
      (v) => v === 'available' || v === 'preferred'
    ).length;

    if (selectedCount === 0) {
      alert('Vui lòng chọn ít nhất 1 ca học sinh CÓ THỂ học.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.saveAvailability({
        studentId,
        studentName: studentName.trim(),
        phone: parentPhone.trim(),
        groupId: groupData.group.id,
        availabilities,
        parentToken,
      });

      if (typeof window !== 'undefined' && res) {
        if (res.parentToken) {
          localStorage.setItem(`parent_token_${groupData.group.code}`, res.parentToken);
          setParentToken(res.parentToken);
        }
        if (res.student?.id) {
          localStorage.setItem(`student_id_${groupData.group.code}`, res.student.id);
          setStudentId(res.student.id);
        }
      }

      setSaveSuccess(true);
      setIsEditingExisting(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Lưu lịch thất bại, vui lòng thử lại';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const availableCount = Object.values(availabilities).filter(
    (v) => v === 'available' || v === 'preferred'
  ).length;
  const preferredCount = Object.values(availabilities).filter((v) => v === 'preferred').length;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-linear-to-r from-indigo-700 to-violet-700 rounded-2xl p-6 text-white shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
              <Calendar className="w-5 h-5 text-indigo-200" />
            </span>
            <span className="text-xs uppercase tracking-widest font-bold text-indigo-200">
              Cổng Đăng Ký Khả Năng Học (Phụ Huynh)
            </span>
          </div>

          {onBackToTeacher && (
            <button
              onClick={onBackToTeacher}
              className="text-xs text-white/80 hover:text-white underline font-medium"
            >
              Chuyển sang giao diện Giáo Viên
            </button>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
          {groupData ? `ĐĂNG KÝ LỊCH HỌC - ${groupData.group.name}` : 'ĐĂNG KÝ LỊCH HỌC'}
        </h1>
        <p className="text-xs sm:text-sm text-indigo-100 max-w-xl">
          Phụ huynh chỉ cần nhập họ tên con, số điện thoại và đánh dấu các ca con <b>CÓ THỂ HỌC</b> hoặc <b>ƯU TIÊN</b>. Hệ thống sẽ dựa vào dữ liệu này để giáo viên chọn phương án lịch học tối ưu cho cả lớp.
        </p>

        <div className="flex items-center gap-2 text-[11px] text-indigo-200 pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          <span>Bảo mật tuyệt đối: Phụ huynh không nhìn thấy thông tin của các học sinh khác.</span>
        </div>
      </div>

      {/* Step 1: Group Lookup */}
      {!groupData && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
              1
            </span>
            <span>Nhập Mã Nhóm Học</span>
          </div>

          <p className="text-xs text-slate-500">
            Mã nhóm do thầy/cô cung cấp (ví dụ: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded-sm">TOAN8A26</code> hoặc <code className="font-mono bg-slate-100 px-1 py-0.5 rounded-sm">TOAN9VIP</code>):
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookupGroup(groupCodeInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Nhập mã nhóm (VD: TOAN8A26)"
              value={groupCodeInput}
              onChange={(e) => setGroupCodeInput(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm uppercase font-mono font-bold tracking-wider focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loadingGroup || !groupCodeInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>{loadingGroup ? 'Đang tìm...' : 'Vào nhóm'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {groupError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{groupError}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2 & 3: Fill Student Info & Availability Grid */}
      {groupData && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Info Card */}
          <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Thông Tin Lớp Học
                </span>
                <h2 className="text-xl font-black text-slate-900">{groupData.group.name}</h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Mã: {groupData.group.code}
                </span>
                <button
                  type="button"
                  onClick={() => setGroupData(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Đổi nhóm khác
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block">Môn học:</span>
                <span className="font-semibold text-slate-800">{groupData.group.subject}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Khối lớp:</span>
                <span className="font-semibold text-slate-800">{groupData.group.grade}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Số buổi cần học:</span>
                <span className="font-semibold text-indigo-700">
                  {groupData.group.sessionsPerWeek} buổi / tuần
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Giáo viên:</span>
                <span className="font-semibold text-slate-800">{groupData.teacherName}</span>
              </div>
            </div>

            {groupData.group.isLocked && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <b>Lịch nhóm đã được giáo viên chốt khóa:</b> Lịch học đã được khóa chính thức, không thể thay đổi lúc này.
                </span>
              </div>
            )}
          </div>

          {/* Requirement 11: Dedicated Confirmation View after submission */}
          {saveSuccess ? (
            <div className="bg-white p-8 rounded-2xl border-2 border-emerald-400 shadow-md text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-bold tracking-widest text-emerald-600">
                  Gửi Thành Công
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Đã ghi nhận lịch của {studentName}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                  Dữ liệu đã được lưu an toàn vào hệ thống của thầy/cô <b>{groupData.teacherName}</b>.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 inline-flex flex-wrap justify-center gap-4 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>{availableCount} ca con CÓ THỂ học</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{preferredCount} ca ƯU TIÊN học</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  id="btn-edit-schedule"
                  onClick={() => setSaveSuccess(false)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <span>✎ CHỈNH SỬA LỊCH</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {isEditingExisting && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Đang cập nhật lịch của:</span>
                    <span className="font-semibold text-indigo-700 underline">{studentName}</span>
                  </div>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    (Gửi lại sẽ cập nhật lịch, không tạo học sinh trùng)
                  </span>
                </div>
              )}

              {/* Student Info Inputs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                    2
                  </span>
                  <span>Thông Tin Học Sinh</span>
                </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn An"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại phụ huynh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="VD: 0912 345 678"
                  value={parentPhone}
                  onChange={(e) => {
                    setParentPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 ${
                    phoneError
                      ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-400'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
                {phoneError ? (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{phoneError}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Bắt buộc • Dùng để giáo viên liên hệ chốt lịch và nhận diện học sinh khi gửi lại.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Availability Grid (5x7 Matrix) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                  3
                </span>
                <span>Đánh Dấu Các Ca Con Có Thể Học</span>
              </div>

              {/* Status summary */}
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span>Đã chọn:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {availableCount} ca có thể
                </span>
                {preferredCount > 0 && (
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    {preferredCount} ưu tiên ★
                  </span>
                )}
              </div>
            </div>

            {/* Instruction legend (Section 4) */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-700">
                Quy ước 3 trạng thái của từng ô ca học:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                  <span className="w-6 h-6 rounded-md bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-400">
                    ✕
                  </span>
                  <div>
                    <div className="font-bold text-slate-700">KHÔNG THỂ HỌC</div>
                    <div className="text-[10px] text-slate-400">Tuyệt đối không xếp ca này</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="w-6 h-6 rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold">
                    ✓
                  </span>
                  <div>
                    <div className="font-bold text-emerald-800">CÓ THỂ HỌC</div>
                    <div className="text-[10px] text-emerald-600">Con sẵn sàng học được</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center font-bold">
                    ★
                  </span>
                  <div>
                    <div className="font-bold text-amber-800">ƯU TIÊN</div>
                    <div className="text-[10px] text-amber-600">Rất mong muốn học ca này</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick selection chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-slate-400 self-center text-[11px]">Chọn nhanh:</span>
              <button
                type="button"
                onClick={() => handleQuickSelect('all_evening')}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium"
              >
                Tất cả CA TỐI
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('all_c3_c4')}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium"
              >
                Tất cả CA 3 & CA 4
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('clear')}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs"
              >
                Xóa tất cả
              </button>
            </div>

            {/* Matrix 5 slots x 7 days */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2.5 px-3 w-28 font-bold text-xs text-slate-500 uppercase tracking-wider text-center border-r border-slate-200">
                      Ca học
                    </th>
                    {DAYS_CONFIG.map((day) => (
                      <th
                        key={day.key}
                        className="py-2.5 px-2 font-bold text-xs text-slate-700 text-center border-r border-slate-200 last:border-r-0"
                      >
                        <div className="text-slate-900 font-bold text-sm">{day.label}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{day.fullLabel}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {SLOTS_CONFIG.map((slot) => (
                    <tr key={slot.id} className="hover:bg-slate-50/40 transition-colors">
                      {/* Slot Header */}
                      <td className="p-2 bg-slate-50/70 border-r border-slate-200 text-center">
                        <div className="font-bold text-xs text-slate-900">{slot.label}</div>
                      </td>

                      {/* 7 Days Cells */}
                      {DAYS_CONFIG.map((day) => {
                        const key = `${day.key}_${slot.id}`;
                        const legacyKey = slot.legacyAlias ? `${day.key}_${slot.legacyAlias}` : null;
                        const status = availabilities[key] || (legacyKey ? availabilities[legacyKey] : undefined) || 'unavailable';

                        const teacherSlotConf = groupData.slotTimes[key] || (legacyKey ? groupData.slotTimes[legacyKey] : undefined);
                        const isTeacherBusy = teacherSlotConf?.enabled === false;
                        const startTime = teacherSlotConf?.startTime || slot.defaultStartTime;
                        const endTime = teacherSlotConf?.endTime || slot.defaultEndTime;

                        if (isTeacherBusy) {
                          return (
                            <td
                              key={day.key}
                              className="p-1.5 border-r border-slate-200 last:border-r-0 bg-slate-50/70 text-center"
                            >
                              <div className="h-14 rounded-lg border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                                <span>Giáo viên bận</span>
                              </div>
                            </td>
                          );
                        }

                        let cellClass =
                          'bg-slate-50/50 border border-slate-200 text-slate-400 hover:bg-slate-100';
                        if (status === 'available') {
                          cellClass =
                            'bg-emerald-500 border-emerald-600 text-white shadow-xs font-bold';
                        } else if (status === 'preferred') {
                          cellClass =
                            'bg-amber-500 border-amber-600 text-white shadow-xs font-bold';
                        }

                        return (
                          <td
                            key={day.key}
                            className="p-1.5 border-r border-slate-200 last:border-r-0 text-center"
                          >
                            <button
                              type="button"
                              onClick={() => handleCellClick(day.key, slot.id)}
                              disabled={groupData.group.isLocked}
                              className={`w-full h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${cellClass} disabled:opacity-50`}
                            >
                              {status === 'available' ? (
                                <>
                                  <Check className="w-4 h-4 stroke-[3]" />
                                  <span className="text-[10px]">Có thể</span>
                                </>
                              ) : status === 'preferred' ? (
                                <>
                                  <Star className="w-4 h-4 fill-white" />
                                  <span className="text-[10px]">Ưu tiên ★</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-300 text-xs">✕</span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {startTime}
                                  </span>
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submit Button */}
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-600">
                Đã chọn <b>{availableCount}</b> ca học sinh có thể học ({preferredCount} ca ưu tiên ★)
              </span>
              <p className="text-[11px] text-slate-400">
                Ca đánh dấu ✕ là điều kiện cứng: Hệ thống sẽ tuyệt đối không xếp con vào ca đó.
              </p>
            </div>

            <button
              id="btn-save-parent-availability"
              type="submit"
              disabled={saving || groupData.group.isLocked}
              className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-98"
            >
              {saving ? (
                <span>Đang gửi...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditingExisting ? 'GỬI LẠI LỊCH (CẬP NHẬT)' : 'GỬI LỊCH'}</span>
                </>
              )}
            </button>
          </div>
          </>
          )}
        </form>
      )}
    </div>
  );
};
