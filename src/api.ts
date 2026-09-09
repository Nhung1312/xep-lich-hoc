import {
  Group,
  Student,
  StudentAvailabilityDoc,
  TeacherConfig,
  ScheduleSession,
  OptimizationResult,
  GroupSuggestion,
  AvailabilityStatus,
  ScheduleCombinationOption,
  GroupDifficulty,
  ImpactAnalysisResult,
  GlobalOptimizationProposal,
  DayKey,
  SlotKey,
} from './types.ts';

export interface AppState {
  teacherConfig: TeacherConfig;
  groups: Group[];
  students: Student[];
  availabilities: Record<string, StudentAvailabilityDoc>;
  schedules: ScheduleSession[];
  lastOptimizationResult: OptimizationResult | null;
}

export const api = {
  async getState(): Promise<AppState> {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem('cached_teacher_state', JSON.stringify(data));
        } catch {}
        return data;
      }
      console.warn('API /api/state returned non-OK status:', res.status);
    } catch (netErr) {
      console.warn('Network error accessing /api/state:', netErr);
    }

    // Try localStorage backup if server is momentarily unreachable
    try {
      const cached = localStorage.getItem('cached_teacher_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.groups)) {
          console.info('Loaded state from local cache');
          return parsed;
        }
      }
    } catch {}

    throw new Error('Không thể tải dữ liệu từ máy chủ');
  },

  async getGroupByCode(code: string): Promise<{
    group: Group;
    teacherName: string;
    slotTimes: TeacherConfig['slotTimes'];
    defaultSlotTimes?: TeacherConfig['defaultSlotTimes'];
  }> {
    const res = await fetch(`/api/groups/by-code/${encodeURIComponent(code)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không tìm thấy nhóm học');
    }
    return res.json();
  },

  async createGroup(data: Partial<Group>): Promise<Group> {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Tạo nhóm thất bại');
    return res.json();
  },

  async updateGroup(id: string, data: Partial<Group>): Promise<Group> {
    const res = await fetch(`/api/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Cập nhật nhóm thất bại');
    return res.json();
  },

  async deleteGroup(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Xóa nhóm thất bại');
    return res.json();
  },

  async addStudent(data: {
    name: string;
    phone?: string;
    parentName?: string;
    groupId: string;
  }): Promise<Student> {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Thêm học sinh thất bại');
    return res.json();
  },

  async updateStudent(id: string, data: Partial<Student>): Promise<Student> {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Cập nhật học sinh thất bại');
    return res.json();
  },

  async deleteStudent(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Xóa học sinh thất bại');
    return res.json();
  },

  async getAvailability(studentId: string): Promise<StudentAvailabilityDoc> {
    const res = await fetch(`/api/availabilities/${studentId}`);
    if (!res.ok) throw new Error('Lỗi lấy thông tin lịch');
    return res.json();
  },

  async getMySubmission(
    code: string,
    token: string
  ): Promise<{ success: boolean; student: Student; availability: StudentAvailabilityDoc }> {
    const res = await fetch(
      `/api/parent/my-submission?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không tìm thấy dữ liệu đã gửi');
    }
    return res.json();
  },

  async saveAvailability(data: {
    studentId?: string;
    studentName?: string;
    groupId: string;
    phone?: string;
    parentName?: string;
    parentToken?: string;
    availabilities: Record<string, AvailabilityStatus>;
  }): Promise<{
    success: boolean;
    student: Student;
    parentToken: string;
    availability: StudentAvailabilityDoc;
    isNew: boolean;
  }> {
    const res = await fetch('/api/availabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Lưu lịch thất bại');
    }
    return res.json();
  },

  async updateTeacherConfig(data: Partial<TeacherConfig>): Promise<TeacherConfig> {
    const res = await fetch('/api/teacher-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Cập nhật cấu hình giáo viên thất bại');
    return res.json();
  },

  // Section 17: Get group difficulty ratings
  async getGroupDifficulties(): Promise<{ difficulties: GroupDifficulty[] }> {
    const res = await fetch('/api/schedules/group-difficulty');
    if (!res.ok) throw new Error('Lỗi lấy đánh giá độ khó của nhóm');
    return res.json();
  },

  // Section 6 & 7: Analyze combinations for a group
  async analyzeGroupCombinations(groupId: string): Promise<{ options: ScheduleCombinationOption[] }> {
    const res = await fetch('/api/schedules/analyze-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId }),
    });
    if (!res.ok) throw new Error('Phân tích phương án ca thất bại');
    return res.json();
  },

  // Section 8: Select option for group (Tentative)
  async selectGroupOption(groupId: string, option: ScheduleCombinationOption): Promise<{ success: boolean; group: Group; schedules: ScheduleSession[] }> {
    const res = await fetch('/api/schedules/select-group-option', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, option }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Chọn phương án lịch thất bại');
    }
    return res.json();
  },

  // Section 14: Check impact before moving session
  async checkSessionImpact(data: {
    groupId: string;
    fromSessionId: string;
    toDay: DayKey;
    toSlot: SlotKey;
  }): Promise<{ impact: ImpactAnalysisResult }> {
    const res = await fetch('/api/schedules/impact-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Kiểm tra ảnh hưởng thay đổi thất bại');
    }
    return res.json();
  },

  // Section 15: Reset / Re-schedule single group
  async resetGroupSchedule(groupId: string): Promise<{ success: boolean }> {
    const res = await fetch('/api/schedules/reset-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Xếp lại nhóm thất bại');
    }
    return res.json();
  },

  // Confirm group schedule
  async confirmGroupSchedule(groupId: string): Promise<{ success: boolean; group: Group }> {
    const res = await fetch('/api/schedules/confirm-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Xác nhận lịch nhóm thất bại');
    }
    return res.json();
  },

  // Lock group toggle
  async toggleLockGroup(groupId: string, isLocked: boolean): Promise<{ success: boolean; group: Group }> {
    const res = await fetch('/api/schedules/lock-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, isLocked }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Đổi trạng thái khóa thất bại');
    }
    return res.json();
  },

  async lockGroup(groupId: string, isLocked: boolean): Promise<{ success: boolean; group: Group }> {
    return this.toggleLockGroup(groupId, isLocked);
  },

  // Section 16: Global optimization analysis
  async getGlobalOptimizationProposal(): Promise<{ proposal: GlobalOptimizationProposal }> {
    const res = await fetch('/api/schedules/global-analysis');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Phân tích tối ưu toàn bộ thất bại');
    }
    return res.json();
  },

  async runAutoSchedule(mode: 'full' | 'partial'): Promise<OptimizationResult> {
    const res = await fetch('/api/schedules/auto-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Chạy thuật toán xếp lịch thất bại');
    }
    return res.json();
  },

  async applyOptimizationProposal(): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/schedules/apply-optimization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Áp dụng đề xuất tối ưu thất bại');
    }
    return res.json();
  },

  async saveManualSchedules(schedules: ScheduleSession[]): Promise<{ success: boolean }> {
    const res = await fetch('/api/schedules/manual-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedules }),
    });
    if (!res.ok) throw new Error('Lưu lịch thủ công thất bại');
    return res.json();
  },

  async getGroupSuggestions(): Promise<{ suggestions: GroupSuggestion[] }> {
    const res = await fetch('/api/schedules/auto-group-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Lấy đề xuất nhóm thất bại');
    return res.json();
  },

  async applyGroupSuggestion(data: {
    suggestionId: string;
    name: string;
    subject: string;
    grade: string;
    dayOfWeek: string;
    slot: string;
    studentIds: string[];
  }): Promise<{ success: boolean; newGroup: Group }> {
    const res = await fetch('/api/schedules/apply-group-suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Áp dụng đề xuất nhóm thất bại');
    return res.json();
  },

  async resetSeedData(): Promise<{ success: boolean; message: string; data: AppState }> {
    const res = await fetch('/api/reset-data', { method: 'POST' });
    if (!res.ok) throw new Error('Khôi phục dữ liệu thất bại');
    return res.json();
  },

  async switchToRealMode(): Promise<{ success: boolean; message: string; data: AppState }> {
    const res = await fetch('/api/data-mode/real', { method: 'POST' });
    if (!res.ok) throw new Error('Chuyển sang chế độ dữ liệu thực thất bại');
    return res.json();
  },

  async resetToDemoSeed(): Promise<{ success: boolean; message: string; data: AppState }> {
    const res = await fetch('/api/data-mode/reset-demo', { method: 'POST' });
    if (!res.ok) throw new Error('Khôi phục dữ liệu mẫu thất bại');
    return res.json();
  },
};
