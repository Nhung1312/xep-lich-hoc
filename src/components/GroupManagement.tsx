import React, { useState } from 'react';
import {
  Group,
  Student,
  StudentAvailabilityDoc,
  ScheduleSession,
  DAYS_CONFIG,
  SLOTS_CONFIG,
  DayKey,
  SlotKey,
  getSlotLabel,
} from '../types.ts';
import { api } from '../api.ts';
import {
  Plus,
  Trash2,
  Edit2,
  Users,
  QrCode,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  Clock,
  Sparkles,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';

interface Props {
  groups: Group[];
  students: Student[];
  schedules: ScheduleSession[];
  availabilities: Record<string, StudentAvailabilityDoc>;
  onRefresh: () => void;
  onOpenQR: (group: Group) => void;
  onAnalyzeGroup: (group: Group) => void;
  onEditGroup: (group: Group) => void;
}

export const GroupManagement: React.FC<Props> = ({
  groups,
  students,
  schedules,
  availabilities,
  onRefresh,
  onOpenQR,
  onAnalyzeGroup,
  onEditGroup,
}) => {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedStudentForView, setSelectedStudentForView] = useState<Student | null>(null);
  const [addingStudentToGroupId, setAddingStudentToGroupId] = useState<string | null>(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');

  // New Group Form State
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState('Khối 8');
  const [maxStudents, setMaxStudents] = useState(8);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [allowedDays, setAllowedDays] = useState<DayKey[]>(['2', '3', '4', '5', '6', '7']);
  const [allowedSlots, setAllowedSlots] = useState<SlotKey[]>(['c1', 'c2', 'c3', 'c4', 'ct']);
  const [saving, setSaving] = useState(false);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setSaving(true);
    try {
      await api.createGroup({
        name: groupName.trim(),
        subject,
        grade,
        maxStudents: Number(maxStudents),
        sessionsPerWeek: Number(sessionsPerWeek),
        durationMinutes: Number(durationMinutes),
        allowedDays,
        allowedSlots,
      });
      setShowCreateGroup(false);
      setGroupName('');
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Tạo nhóm thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa nhóm "${name}" cùng toàn bộ học sinh trong nhóm?`)) {
      return;
    }
    try {
      await api.deleteGroup(id);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Xóa nhóm thất bại');
    }
  };

  const handleToggleLockGroup = async (groupId: string, currentLocked: boolean) => {
    try {
      await api.lockGroup(groupId, !currentLocked);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Thay đổi trạng thái khóa nhóm thất bại');
    }
  };

  const handleAddStudent = async (groupId: string) => {
    if (!newStudentName.trim()) return;
    try {
      await api.addStudent({
        groupId,
        name: newStudentName.trim(),
        phone: newStudentPhone.trim(),
      });
      setNewStudentName('');
      setNewStudentPhone('');
      setAddingStudentToGroupId(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Thêm học sinh thất bại');
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa học sinh "${name}"?`)) return;
    try {
      await api.deleteStudent(id);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Xóa học sinh thất bại');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Quản Lý Nhóm Học & Danh Sách Học Sinh
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tạo nhóm, thêm học sinh, lấy mã tham gia & theo dõi tiến độ nộp lịch của phụ huynh.
          </p>
        </div>

        <button
          id="btn-open-create-group"
          onClick={() => setShowCreateGroup(!showCreateGroup)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo nhóm học mới</span>
        </button>
      </div>

      {/* Create Group Modal/Form */}
      {showCreateGroup && (
        <div className="bg-white p-5 rounded-xl border border-indigo-200 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Thêm Nhóm Học Mới</h3>
            <button
              onClick={() => setShowCreateGroup(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Hủy
            </button>
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tên nhóm học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Toán 8A Nâng cao"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Môn học</label>
                <input
                  type="text"
                  placeholder="VD: Toán, Tiếng Anh..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Khối lớp</label>
                <input
                  type="text"
                  placeholder="VD: Khối 8, Khối 9..."
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sĩ số tối đa (HS)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Số buổi học mỗi tuần
                </label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Thời lượng mỗi buổi (phút)
                </label>
                <input
                  type="number"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Allowed Days */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Các ngày được phép xếp lịch cho nhóm:
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_CONFIG.map((d) => {
                  const checked = allowedDays.includes(d.key);
                  return (
                    <label
                      key={d.key}
                      className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setAllowedDays(
                            checked
                              ? allowedDays.filter((x) => x !== d.key)
                              : [...allowedDays, d.key]
                          );
                        }}
                        className="hidden"
                      />
                      <span>{d.fullLabel}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateGroup(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
              >
                {saving ? 'Đang tạo...' : 'Tạo nhóm'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Groups List */}
      <div className="space-y-4">
        {groups.map((grp) => {
          const grpStudents = students.filter((s) => s.groupId === grp.id);
          const submittedCount = grpStudents.filter((s) => s.hasSubmitted).length;
          const grpSessions = schedules.filter((s) => s.groupId === grp.id);
          const hasSchedule = grpSessions.length > 0;

          return (
            <div
              key={grp.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Group Bar */}
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{grp.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Mã: {grp.code}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({grp.subject} • {grp.grade})
                    </span>

                    {/* Status Badge */}
                    {grp.isLocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-white shadow-2xs">
                        <Lock className="w-3 h-3" />
                        <span>Đã khóa chính thức</span>
                      </span>
                    ) : hasSchedule ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Lịch dự kiến</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Chưa xếp lịch
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="font-semibold text-slate-700">
                      Tổng số: <b>{grpStudents.length}</b>/{grp.maxStudents} học sinh
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>
                      Cần học: <b>{grp.sessionsPerWeek} buổi/tuần</b>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="font-bold text-emerald-700">
                        {submittedCount}/{grpStudents.length} đã khai báo
                      </span>
                    </span>
                    {grpStudents.length - submittedCount > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="font-bold text-amber-700">
                          {grpStudents.length - submittedCount} học sinh chưa khai báo
                        </span>
                      </span>
                    )}

                    {hasSchedule && (
                      <span className="text-indigo-700 font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          Đang xếp: {grpSessions.map((s) => {
                            const d = DAYS_CONFIG.find((x) => x.key === s.dayOfWeek)?.label;
                            const slotName = getSlotLabel(s.slot);
                            return `${d} ${slotName}`;
                          }).join(', ')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Button: Phân tích & Đề xuất lịch (Section 6) */}
                  <button
                    onClick={() => onAnalyzeGroup(grp)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Phân tích tổ hợp ca và đề xuất các phương án tối ưu"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Phân tích & Đề xuất lịch</span>
                  </button>

                  {/* Button: Chỉnh sửa lịch */}
                  <button
                    onClick={() => onEditGroup(grp)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Chỉnh sửa lịch</span>
                  </button>

                  {/* Button: Khóa / Mở khóa lịch (Section 12) */}
                  {hasSchedule && (
                    <button
                      onClick={() => handleToggleLockGroup(grp.id, !!grp.isLocked)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs border ${
                        grp.isLocked
                          ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                          : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                      }`}
                      title={grp.isLocked ? 'Bấm để mở khóa cho phép điều chỉnh' : 'Bấm để chốt lịch chính thức'}
                    >
                      {grp.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{grp.isLocked ? 'Mở khóa' : 'Khóa lịch'}</span>
                    </button>
                  )}

                  {/* QR & Link */}
                  <button
                    onClick={() => onOpenQR(grp)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>QR & Link</span>
                  </button>

                  <button
                    onClick={() => handleDeleteGroup(grp.id, grp.name)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    title="Xóa nhóm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Students in this Group */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Danh sách học sinh ({grpStudents.length} học sinh):
                  </span>

                  <button
                    onClick={() =>
                      setAddingStudentToGroupId(
                        addingStudentToGroupId === grp.id ? null : grp.id
                      )
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm học sinh</span>
                  </button>
                </div>

                {/* Add Student Input Row */}
                {addingStudentToGroupId === grp.id && (
                  <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Họ và tên học sinh *"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white flex-1 min-w-[160px]"
                    />
                    <input
                      type="text"
                      placeholder="Số điện thoại phụ huynh"
                      value={newStudentPhone}
                      onChange={(e) => setNewStudentPhone(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white w-44"
                    />
                    <button
                      onClick={() => handleAddStudent(grp.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                    >
                      Lưu
                    </button>
                    <button
                      onClick={() => setAddingStudentToGroupId(null)}
                      className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Hủy
                    </button>
                  </div>
                )}

                {/* Table of Students */}
                {grpStudents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Chưa có học sinh trong nhóm. Nhấn "Thêm học sinh" hoặc gửi link cho phụ huynh.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[11px] text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="pb-2 font-medium w-10">STT</th>
                          <th className="pb-2 font-medium">Họ và tên học sinh</th>
                          <th className="pb-2 font-medium">SĐT phụ huynh</th>
                          <th className="pb-2 font-medium">Trạng thái gửi lịch</th>
                          <th className="pb-2 font-medium text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grpStudents.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 font-semibold text-slate-800">{st.name}</td>
                            <td className="py-2.5 text-slate-600 font-mono">
                              {st.phone || '---'}
                            </td>
                            <td className="py-2.5">
                              {st.hasSubmitted ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Đã gửi lịch</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Chưa gửi</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right space-x-2">
                              {st.hasSubmitted && (
                                <button
                                  onClick={() => setSelectedStudentForView(st)}
                                  className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem lịch</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteStudent(st.id, st.name)}
                                className="text-slate-400 hover:text-rose-600"
                                title="Xóa học sinh"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Student Availability Preview Modal */}
      {selectedStudentForView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedStudentForView(null);
          }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Lịch Rảnh Của {selectedStudentForView.name}
                </h3>
                <p className="text-xs text-slate-500">
                  SĐT: {selectedStudentForView.phone || 'Chưa cập nhật'}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForView(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-center text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2 border-r border-slate-200 text-slate-500 font-bold">Ca</th>
                      {DAYS_CONFIG.map((d) => (
                        <th key={d.key} className="p-2 border-r border-slate-200 last:border-r-0 font-bold">
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {SLOTS_CONFIG.map((slot) => (
                      <tr key={slot.id}>
                        <td className="p-2 font-medium bg-slate-50 border-r border-slate-200 text-[11px]">
                          {slot.label}
                        </td>
                        {DAYS_CONFIG.map((day) => {
                          const key = `${day.key}_${slot.id}`;
                          const legacyKey = slot.legacyAlias ? `${day.key}_${slot.legacyAlias}` : null;
                          const availDoc = availabilities[selectedStudentForView.id];
                          const stat = availDoc?.availabilities[key] || (legacyKey ? availDoc?.availabilities[legacyKey] : undefined);

                          let badge = <span className="text-slate-300">--</span>;
                          if (stat === 'preferred') {
                            badge = (
                              <span className="inline-block px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 font-bold text-[10px]">
                                ★ Ưu tiên
                              </span>
                            );
                          } else if (stat === 'available') {
                            badge = (
                              <span className="inline-block px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                                Có thể
                              </span>
                            );
                          } else if (stat === 'unavailable') {
                            badge = <span className="text-rose-400 text-[11px]">✕</span>;
                          }

                          return (
                            <td key={day.key} className="p-1.5 border-r border-slate-200 last:border-r-0">
                              {badge}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStudentForView(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
