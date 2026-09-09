import express from 'express';
import { dbRepository } from './repository.ts';
import {
  runOptimizationScheduler,
  generateGroupSuggestions,
  analyzeGroupCombinations,
  analyzeGroupsDifficulty,
  analyzeSessionChangeImpact,
  analyzeGlobalOptimization,
} from './scheduler.ts';
import {
  ScheduleSession,
  normalizeSlotKey,
  getSlotTimeDisplay,
} from '../src/types.ts';

export const app = express();

app.use(express.json());

const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: dbRepository.getDatabaseType(),
    timestamp: new Date().toISOString(),
  });
});

// Get full state (for Teacher dashboard)
apiRouter.get('/state', async (_req, res) => {
  try {
    const db = await dbRepository.getState();
    res.json(db);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu';
    res.status(500).json({ error: msg });
  }
});

// Get single group by invitation code (for Parent view)
// CRITICAL PRIVACY: Only returns group metadata & slot times.
const handleGetGroupByCode = async (req: express.Request, res: express.Response) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const group = await dbRepository.getGroupByCode(code);
    const db = await dbRepository.getState();

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tra cứu nhóm';
    res.status(500).json({ error: msg });
  }
};

apiRouter.get('/groups/by-code/:code', handleGetGroupByCode);
apiRouter.get('/groups/code/:code', handleGetGroupByCode);

// Get parent's own submission via secure token
apiRouter.get('/parent/my-submission', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const token = String(req.query.token || '').trim();

    if (!code || !token) {
      res.status(400).json({ error: 'Mã nhóm và mã xác thực là bắt buộc' });
      return;
    }

    const data = await dbRepository.getStudentByParentToken(code, token);
    if (!data) {
      res.status(404).json({ error: 'Chưa có thông tin hoặc liên kết đã hết hạn' });
      return;
    }

    res.json({
      success: true,
      student: data.student,
      availability: data.availability,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy thông tin học sinh';
    res.status(500).json({ error: msg });
  }
});

// Create new group
apiRouter.post('/groups', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Tên nhóm không được để trống' });
    return;
  }

  try {
    const newGroup = await dbRepository.createGroup(req.body);
    res.status(201).json(newGroup);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tạo nhóm thất bại';
    res.status(400).json({ error: msg });
  }
});

// Update group
apiRouter.put('/groups/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const updated = await dbRepository.updateGroup(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Không tìm thấy nhóm' });
      return;
    }
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Cập nhật nhóm thất bại';
    res.status(400).json({ error: msg });
  }
});

// Delete group
apiRouter.delete('/groups/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const success = await dbRepository.deleteGroup(id);
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
apiRouter.post('/students', async (req, res) => {
  const { name, groupId } = req.body;
  if (!name || !groupId) {
    res.status(400).json({ error: 'Tên học sinh và nhóm học là bắt buộc' });
    return;
  }

  try {
    const db = await dbRepository.getState();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) {
      res.status(404).json({ error: 'Nhóm học không tồn tại' });
      return;
    }

    const newStudent = await dbRepository.createStudent(req.body);
    res.status(201).json(newStudent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi thêm học sinh';
    res.status(500).json({ error: msg });
  }
});

// Update student
apiRouter.put('/students/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const updated = await dbRepository.updateStudent(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Học sinh không tồn tại' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật học sinh';
    res.status(500).json({ error: msg });
  }
});

// Delete student
apiRouter.delete('/students/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const success = await dbRepository.deleteStudent(id);
    if (!success) {
      res.status(404).json({ error: 'Học sinh không tồn tại' });
      return;
    }
    res.json({ success: true, deletedId: id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi xóa học sinh';
    res.status(500).json({ error: msg });
  }
});

// Submit / Update student availability (Parent or Teacher)
apiRouter.post('/availabilities', async (req, res) => {
  const { studentId, groupId, studentName, phone, parentName, availabilities, parentToken } =
    req.body;

  if (!groupId || !studentName?.trim()) {
    res.status(400).json({ error: 'Vui lòng nhập họ và tên học sinh và nhóm học' });
    return;
  }

  try {
    const result = await dbRepository.upsertParentSubmission({
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

// Update Teacher Config
apiRouter.put('/teacher-config', async (req, res) => {
  try {
    const updated = await dbRepository.saveTeacherConfig(req.body);
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi lưu cấu hình giáo viên';
    res.status(500).json({ error: msg });
  }
});

// Get Group Difficulty Ratings
apiRouter.get('/schedules/group-difficulty', async (_req, res) => {
  try {
    const db = await dbRepository.getState();
    const difficulties = analyzeGroupsDifficulty(
      db.groups,
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.schedules
    );
    res.json({ difficulties });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi phân tích độ khó nhóm';
    res.status(500).json({ error: msg });
  }
});

// Analyze combinations for a group
apiRouter.post('/schedules/analyze-group', async (req, res) => {
  const { groupId } = req.body;
  try {
    const db = await dbRepository.getState();
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi phân tích tổ hợp lịch';
    res.status(500).json({ error: msg });
  }
});

// Select an option for a group (Trở thành LỊCH DỰ KIẾN - Tentative)
apiRouter.post('/schedules/select-group-option', async (req, res) => {
  const { groupId, option } = req.body;
  if (!groupId || !option) {
    res.status(400).json({ error: 'Thiếu dữ liệu chọn phương án' });
    return;
  }

  try {
    const result = await dbRepository.selectGroupOption(groupId, option);
    res.json({ success: true, group: result.group, schedules: result.schedules });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Không thể chọn phương án';
    res.status(409).json({ error: msg });
  }
});

// Impact Analysis when modifying a session
apiRouter.post('/schedules/impact-check', async (req, res) => {
  const { groupId, fromSessionId, toDay, toSlot } = req.body;
  try {
    const db = await dbRepository.getState();

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi kiểm tra tác động';
    res.status(500).json({ error: msg });
  }
});

// Reset / re-schedule a single group
apiRouter.post('/schedules/reset-group', async (req, res) => {
  const { groupId } = req.body;
  try {
    const success = await dbRepository.resetGroup(groupId);
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
apiRouter.post('/schedules/confirm-group', async (req, res) => {
  const { groupId } = req.body;
  try {
    const group = await dbRepository.confirmGroup(groupId);
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
apiRouter.post('/schedules/lock-group', async (req, res) => {
  const { groupId, isLocked } = req.body;
  try {
    const group = await dbRepository.lockGroup(groupId, !!isLocked);
    if (!group) {
      res.status(404).json({ error: 'Nhóm không tồn tại' });
      return;
    }
    res.json({ success: true, group });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi khóa/mở khóa nhóm';
    res.status(500).json({ error: msg });
  }
});

// Global Optimization Analysis
apiRouter.get('/schedules/global-analysis', async (_req, res) => {
  try {
    const db = await dbRepository.getState();
    const proposal = analyzeGlobalOptimization(
      db.groups,
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.schedules
    );
    res.json({ proposal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi phân tích toàn diện';
    res.status(500).json({ error: msg });
  }
});

// Run full/partial automatic solve
apiRouter.post('/schedules/auto-schedule', async (req, res) => {
  const mode: 'full' | 'partial' = req.body.mode === 'partial' ? 'partial' : 'full';
  try {
    const db = await dbRepository.getState();

    const optimizationResult = runOptimizationScheduler({
      groups: db.groups,
      students: db.students,
      availabilities: db.availabilities,
      teacherConfig: db.teacherConfig,
      existingSchedules: db.schedules,
      mode,
    });

    db.lastOptimizationResult = optimizationResult;
    await dbRepository.saveState(db);

    res.json(optimizationResult);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tính toán đề xuất';
    res.status(500).json({ error: msg });
  }
});

// Explicitly apply optimization proposal upon teacher confirmation
apiRouter.post('/schedules/apply-optimization', async (_req, res) => {
  try {
    const db = await dbRepository.getState();
    const proposal = db.lastOptimizationResult;
    if (!proposal || !proposal.groupSummaries) {
      res.status(400).json({ error: 'Không tìm thấy kết quả đề xuất tối ưu gần nhất' });
      return;
    }

    const protectedGroupIds = new Set(
      db.groups
        .filter((g) => g.isLocked || g.status === 'locked' || g.status === 'confirmed')
        .map((g) => g.id)
    );

    const preservedSchedules = db.schedules.filter((s) => protectedGroupIds.has(s.groupId));
    const newTentativeSchedules: ScheduleSession[] = [];

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
    await dbRepository.saveState(db);

    res.json({ success: true, count: newTentativeSchedules.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi áp dụng đề xuất';
    res.status(500).json({ error: msg });
  }
});

// Teacher manual schedule update
apiRouter.post('/schedules/manual-save', async (req, res) => {
  const { schedules } = req.body;

  if (!Array.isArray(schedules)) {
    res.status(400).json({ error: 'Dữ liệu lịch không hợp lệ' });
    return;
  }

  try {
    const result = await dbRepository.saveManualSchedules(schedules);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Không thể lưu lịch';
    res.status(409).json({ error: msg });
  }
});

// Auto-Group Suggestion Endpoint
apiRouter.post('/schedules/auto-group-suggestions', async (_req, res) => {
  try {
    const db = await dbRepository.getState();
    const suggestions = generateGroupSuggestions(
      db.students,
      db.availabilities,
      db.teacherConfig,
      db.groups
    );
    res.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi gợi ý nhóm';
    res.status(500).json({ error: msg });
  }
});

// Apply a suggested group
apiRouter.post('/schedules/apply-group-suggestion', async (req, res) => {
  const { name, subject, grade, dayOfWeek, slot, studentIds } = req.body;
  try {
    const db = await dbRepository.getState();

    const newGroup = await dbRepository.createGroup({
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
        await dbRepository.updateStudent(sid, { groupId: newGroup.id });
      }
    }

    res.status(201).json({ success: true, newGroup });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi áp dụng nhóm đề xuất';
    res.status(500).json({ error: msg });
  }
});

// Data Mode Endpoints
apiRouter.post('/data-mode/real', async (_req, res) => {
  try {
    const realDb = await dbRepository.switchToRealMode();
    res.json({ success: true, message: 'Đã chuyển sang chế độ dữ liệu thực', data: realDb });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi chuyển chế độ';
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/data-mode/reset-demo', async (_req, res) => {
  try {
    const demoDb = await dbRepository.resetToDemoSeed();
    res.json({ success: true, message: 'Đã khôi phục dữ liệu mẫu', data: demoDb });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi khôi phục dữ liệu mẫu';
    res.status(500).json({ error: msg });
  }
});

// Legacy reset alias
apiRouter.post('/reset-data', async (_req, res) => {
  try {
    const freshDb = await dbRepository.resetToDemoSeed();
    res.json({ success: true, message: 'Đã khôi phục dữ liệu mẫu thành công', data: freshDb });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi khôi phục dữ liệu';
    res.status(500).json({ error: msg });
  }
});

// Mount router at both /api and root / so Vercel rewrites work seamlessly
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
