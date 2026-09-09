import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbRepository } from './server/repository.ts';
import {
  runOptimizationScheduler,
  generateGroupSuggestions,
  analyzeGroupCombinations,
  analyzeGroupsDifficulty,
  analyzeSessionChangeImpact,
  analyzeGlobalOptimization,
} from './server/scheduler.ts';
import {
  Group,
  Student,
  ScheduleSession,
  normalizeSlotKey,
  getSlotTimeDisplay,
} from './src/types.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get full state (for Teacher dashboard)
  app.get('/api/state', (_req, res) => {
    const db = dbRepository.getState();
    res.json(db);
  });

  // Get single group by invitation code (for Parent view)
  // CRITICAL PRIVACY: Only returns group metadata & slot times.
  // Never returns students or availabilities of others!
  const handleGetGroupByCode = (req: express.Request, res: express.Response) => {
    const code = req.params.code.trim().toUpperCase();
    const group = dbRepository.getGroupByCode(code);
    const db = dbRepository.getState();

    if (!group) {
      res.status(404).json({ error: 'Không tìm thấy nhóm học với mã này. Vui lòng kiểm tra lại.' });
      return;
    }

    res.json({
      group,
      teacherName: db.teacherConfig.teacherName,
      slotTimes: db.teacherConfig.slotTimes,
      defaultSlotTimes: db.teacherConfig.defaultSlotTimes,
    });
  };

  app.get('/api/groups/by-code/:code', handleGetGroupByCode);
  app.get('/api/groups/code/:code', handleGetGroupByCode);

  // Get parent's own submission via secure token (for returning parent editing child's schedule)
  // Only returns the parent's own child and availability. Does NOT show other students!
  app.get('/api/parent/my-submission', (req, res) => {
    const code = String(req.query.code || '').trim();
    const token = String(req.query.token || '').trim();

    if (!code || !token) {
      res.status(400).json({ error: 'Mã nhóm và mã xác thực là bắt buộc' });
      return;
    }

    const data = dbRepository.getStudentByParentToken(code, token);
    if (!data) {
      res.status(404).json({ error: 'Chưa có thông tin hoặc liên kết đã hết hạn' });
      return;
    }

    res.json({
      success: true,
      student: data.student,
      availability: data.availability,
    });
  });

  // Create new group
  app.post('/api/groups', (req, res) => {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Tên nhóm không được để trống' });
      return;
    }

    try {
      const newGroup = dbRepository.createGroup(req.body);
      res.status(201).json(newGroup);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tạo nhóm thất bại';
      res.status(400).json({ error: msg });
    }
  });

  // Update group
  app.put('/api/groups/:id', (req, res) => {
    const id = req.params.id;
    const updated = dbRepository.updateGroup(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Không tìm thấy nhóm' });
      return;
    }
    res.json(updated);
  });

  // Delete group
  app.delete('/api/groups/:id', (req, res) => {
    const id = req.params.id;
    try {
      const success = dbRepository.deleteGroup(id);
      if (!success) {
        res.status(404).json({ error: 'Không tìm thấy nhóm' });
        return;
      }
      res.json({ success: true, deletedId: id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa nhóm';
      res.status(409).json({ error: msg });
    }
  });

  // Add student directly (Teacher)
  app.post('/api/students', (req, res) => {
    const { name, groupId } = req.body;
    if (!name || !groupId) {
      res.status(400).json({ error: 'Tên học sinh và nhóm học là bắt buộc' });
      return;
    }

    const db = dbRepository.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) {
      res.status(404).json({ error: 'Nhóm học không tồn tại' });
      return;
    }

    const newStudent = dbRepository.createStudent(req.body);
    res.status(201).json(newStudent);
  });

  // Update student
  app.put('/api/students/:id', (req, res) => {
    const id = req.params.id;
    const updated = dbRepository.updateStudent(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Học sinh không tồn tại' });
      return;
    }
    res.json(updated);
  });

  // Delete student
  app.delete('/api/students/:id', (req, res) => {
    const id = req.params.id;
    const success = dbRepository.deleteStudent(id);
    if (!success) {
      res.status(404).json({ error: 'Học sinh không tồn tại' });
      return;
    }
    res.json({ success: true, deletedId: id });
  });

  // Submit / Update student availability (Parent or Teacher)
  // Guarantees: Never creates duplicate students!
  // Stores parent access token and returns it so parent can edit without creating a new student.
  app.post('/api/availabilities', (req, res) => {
    const { studentId, groupId, studentName, phone, parentName, availabilities, parentToken } =
      req.body;

    if (!groupId || !studentName?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập họ và tên học sinh và nhóm học' });
      return;
    }

    try {
      const result = dbRepository.upsertParentSubmission({
        groupId,
        studentName,
        phone,
        parentName,
        availabilities: availabilities || {},
        studentId,
        parentToken,
      });

      res.json({
        success: true,
        student: result.student,
        parentToken: result.parentToken,
        availability: result.availability,
        isNew: result.isNew,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lưu khả năng học thất bại';
      res.status(400).json({ error: msg });
    }
  });

  // Update Teacher Config (slot hours and teacher availability)
  app.put('/api/teacher-config', (req, res) => {
    const updated = dbRepository.saveTeacherConfig(req.body);
    res.json(updated);
  });

  // Get Group Difficulty Ratings (Ưu tiên các nhóm khó xếp)
  app.get('/api/schedules/group-difficulty', (_req, res) => {
    const db = dbRepository.getState();
    const difficulties = analyzeGroupsDifficulty(
      db.groups,
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.schedules
    );
    res.json({ difficulties });
  });

  // Analyze combinations for a group (Tổ hợp ca khả thi)
  app.post('/api/schedules/analyze-group', (req, res) => {
    const { groupId } = req.body;
    const db = dbRepository.getState();
    const group = db.groups.find((g) => g.id === groupId);

    if (!group) {
      res.status(404).json({ error: 'Nhóm không tồn tại' });
      return;
    }

    const options = analyzeGroupCombinations(
      groupId,
      db.groups,
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.schedules
    );

    res.json({ options });
  });

  // Select an option for a group (Trở thành LỊCH DỰ KIẾN - Tentative)
  app.post('/api/schedules/select-group-option', (req, res) => {
    const { groupId, option } = req.body;
    if (!groupId || !option) {
      res.status(400).json({ error: 'Thiếu dữ liệu chọn phương án' });
      return;
    }

    try {
      const result = dbRepository.selectGroupOption(groupId, option);
      res.json({ success: true, group: result.group, schedules: result.schedules });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể chọn phương án';
      res.status(409).json({ error: msg });
    }
  });

  // Impact Analysis when modifying a session
  app.post('/api/schedules/impact-check', (req, res) => {
    const { groupId, fromSessionId, toDay, toSlot } = req.body;
    const db = dbRepository.getState();

    const impact = analyzeSessionChangeImpact(
      groupId,
      fromSessionId,
      toDay,
      toSlot,
      db.groups,
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.schedules
    );

    res.json({ impact });
  });

  // Reset / re-schedule a single group
  app.post('/api/schedules/reset-group', (req, res) => {
    const { groupId } = req.body;
    try {
      const success = dbRepository.resetGroup(groupId);
      if (!success) {
        res.status(404).json({ error: 'Nhóm không tồn tại' });
        return;
      }
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đặt lại lịch nhóm';
      res.status(409).json({ error: msg });
    }
  });

  // Confirm group schedule (Chuyển sang ĐÃ XÁC NHẬN)
  app.post('/api/schedules/confirm-group', (req, res) => {
    const { groupId } = req.body;
    try {
      const group = dbRepository.confirmGroup(groupId);
      if (!group) {
        res.status(404).json({ error: 'Nhóm không tồn tại' });
        return;
      }
      res.json({ success: true, group });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xác nhận lịch nhóm';
      res.status(409).json({ error: msg });
    }
  });

  // Toggle group lock (ĐÃ KHÓA / MỞ KHÓA)
  app.post('/api/schedules/lock-group', (req, res) => {
    const { groupId, isLocked } = req.body;
    const group = dbRepository.lockGroup(groupId, !!isLocked);
    if (!group) {
      res.status(404).json({ error: 'Nhóm không tồn tại' });
      return;
    }
    res.json({ success: true, group });
  });

  // Global Optimization Analysis
  app.get('/api/schedules/global-analysis', (_req, res) => {
    const db = dbRepository.getState();
    const proposal = analyzeGlobalOptimization(
      db.groups,
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.schedules
    );
    res.json({ proposal });
  });

  // Run full/partial automatic solve (PROPOSAL ONLY - KHÔNG TỰ Ý CHỐT VÀO DB)
  app.post('/api/schedules/auto-schedule', (req, res) => {
    const mode: 'full' | 'partial' = req.body.mode === 'partial' ? 'partial' : 'full';
    const db = dbRepository.getState();

    const optimizationResult = runOptimizationScheduler({
      groups: db.groups,
      students: db.students,
      availabilities: db.availabilities,
      teacherConfig: db.teacherConfig,
      existingSchedules: db.schedules,
      mode,
    });

    // Save as lastOptimizationResult for analytical review, without overwriting existing schedules or group statuses
    db.lastOptimizationResult = optimizationResult;
    dbRepository.saveState(db);

    res.json(optimizationResult);
  });

  // Explicitly apply optimization proposal upon teacher confirmation
  app.post('/api/schedules/apply-optimization', (_req, res) => {
    const db = dbRepository.getState();
    const proposal = db.lastOptimizationResult;
    if (!proposal || !proposal.groupSummaries) {
      res.status(400).json({ error: 'Không tìm thấy kết quả đề xuất tối ưu gần nhất' });
      return;
    }

    // Protected groups: LOCKED and CONFIRMED groups MUST NEVER be overwritten
    const protectedGroupIds = new Set(
      db.groups
        .filter((g) => g.isLocked || g.status === 'locked' || g.status === 'confirmed')
        .map((g) => g.id)
    );

    const preservedSchedules = db.schedules.filter((s) => protectedGroupIds.has(s.groupId));
    const newTentativeSchedules: ScheduleSession[] = [];

    // Slot usage tracking to prevent conflicts
    const occupiedTeacherSlots = new Set<string>();
    for (const s of preservedSchedules) {
      occupiedTeacherSlots.add(`${s.dayOfWeek}_${normalizeSlotKey(s.slot)}`);
    }

    for (const grpSummary of proposal.groupSummaries) {
      if (protectedGroupIds.has(grpSummary.groupId)) continue;

      const group = db.groups.find((g) => g.id === grpSummary.groupId);
      if (!group) continue;

      for (const sess of grpSummary.sessions) {
        const normSlot = normalizeSlotKey(sess.slot);
        const slotKey = `${sess.dayOfWeek}_${normSlot}`;
        if (occupiedTeacherSlots.has(slotKey)) {
          // Skip conflicting slot in proposal to maintain hard constraint
          continue;
        }
        occupiedTeacherSlots.add(slotKey);

        const timeInfo = getSlotTimeDisplay(sess.dayOfWeek, normSlot, db.teacherConfig);

        newTentativeSchedules.push({
          id: `sess_${grpSummary.groupId}_${sess.dayOfWeek}_${normSlot}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          groupId: grpSummary.groupId,
          dayOfWeek: sess.dayOfWeek,
          slot: normSlot,
          startTime: timeInfo.startTime,
          endTime: timeInfo.endTime,
          isLocked: false,
          status: 'tentative',
          studentIds: sess.students.map((s) => s.id),
        });
      }

      group.status = 'tentative';
    }

    db.schedules = [...preservedSchedules, ...newTentativeSchedules];
    dbRepository.saveState(db);

    res.json({ success: true, count: newTentativeSchedules.length });
  });

  // Teacher manual schedule update
  // Checks that locked groups are not altered, teacher doesn't double-book, and students don't double-book
  app.post('/api/schedules/manual-save', (req, res) => {
    const { schedules } = req.body;

    if (!Array.isArray(schedules)) {
      res.status(400).json({ error: 'Dữ liệu lịch không hợp lệ' });
      return;
    }

    try {
      const result = dbRepository.saveManualSchedules(schedules);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu lịch';
      res.status(409).json({ error: msg });
    }
  });

  // Auto-Group Suggestion Endpoint
  app.post('/api/schedules/auto-group-suggestions', (_req, res) => {
    const db = dbRepository.getState();
    const suggestions = generateGroupSuggestions(
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.groups
    );
    res.json({ suggestions });
  });

  // Apply a suggested group
  app.post('/api/schedules/apply-group-suggestion', (req, res) => {
    const { name, subject, grade, dayOfWeek, slot, studentIds } = req.body;
    const db = dbRepository.getState();

    const newGroup = dbRepository.createGroup({
      name: name || 'Nhóm Đề Xuất Mới',
      subject: subject || 'Toán',
      grade: grade || 'Khối 8',
      maxStudents: Math.max((studentIds || []).length, 6),
      sessionsPerWeek: 1,
      durationMinutes: 90,
      allowedDays: [dayOfWeek],
      allowedSlots: [slot],
      teacherId: db.teacherConfig.teacherId,
    });

    if (Array.isArray(studentIds)) {
      for (const sid of studentIds) {
        dbRepository.updateStudent(sid, { groupId: newGroup.id });
      }
    }

    res.status(201).json({ success: true, newGroup });
  });

  // Data Mode Endpoints (Demo Mode vs Real Data Mode)
  app.post('/api/data-mode/real', (_req, res) => {
    const realDb = dbRepository.switchToRealMode();
    res.json({ success: true, message: 'Đã chuyển sang chế độ dữ liệu thực', data: realDb });
  });

  app.post('/api/data-mode/reset-demo', (_req, res) => {
    const demoDb = dbRepository.resetToDemoSeed();
    res.json({ success: true, message: 'Đã khôi phục dữ liệu mẫu', data: demoDb });
  });

  // Legacy reset alias
  app.post('/api/reset-data', (_req, res) => {
    const freshDb = dbRepository.resetToDemoSeed();
    res.json({ success: true, message: 'Đã khôi phục dữ liệu mẫu thành công', data: freshDb });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
