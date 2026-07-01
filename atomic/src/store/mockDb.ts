// In-memory mock database used when running in browser (no Tauri/SQLite)
import { format, subDays } from 'date-fns';
import type { Task, Goal, DayActivity, GoalChecklistItem, TaskTimeEntry, Tag } from '../types';

export const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let _nextTaskId = 200;
let _nextGoalId = 100;

const today = format(new Date(), 'yyyy-MM-dd');

// ---------- seed tasks ----------

export const mockTasks: Task[] = [
  { id: 1, title: 'Họp team sprint planning', description: 'Discuss sprint goals and assign tickets', category: 'work', date: today, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
  { id: 2, title: 'Đọc sách 30 phút', description: 'Atomic Habits — chương 7', category: 'personal', date: today, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
  { id: 3, title: 'Tập thể dục buổi sáng', description: 'Chạy bộ 5km + stretch', category: 'health', date: today, is_done: 1, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
  { id: 4, title: 'Review code pull request', description: 'PR #42 — refactor auth module', category: 'work', date: today, is_done: 1, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
  { id: 5, title: 'Gửi báo cáo tuần', description: 'Tổng kết KPI tuần, gửi cho manager', category: 'work', date: today, is_done: 1, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
  { id: 6, title: 'Viết blog post kỹ thuật', description: 'Chủ đề: Zustand vs Redux — so sánh thực tế', category: 'creative', date: today, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
  // Template for recurring task — series_id = null means it IS the template
  { id: 7, title: 'Thiền buổi sáng', description: 'Thở sâu + body scan 15 phút', category: 'mindfulness', date: today, is_done: 1, repeat_daily: 1, series_id: null, repeat_end_date: null, created_at: today, color: null },
  { id: 8, title: 'Lên kế hoạch sprint Q3', description: 'Roadmap tính năng, ước tính effort từng item', category: 'work', date: today, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
  { id: 9, title: 'Học tiếng Anh 1 tiếng', description: 'Luyện nghe IELTS Listening test 3', category: 'learn', date: today, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, created_at: today, color: null },
];

const MOCK_TIME_ENTRIES_KEY = 'mock_time_entries_v3';

function loadMockTimeEntries(): TaskTimeEntry[] {
  try {
    const stored = localStorage.getItem(MOCK_TIME_ENTRIES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [
    { task_id: 7, date: today, start_time: '06:30', end_time: '06:45' },
    { task_id: 3, date: today, start_time: '07:00', end_time: '08:00' },
    { task_id: 6, date: today, start_time: '09:00', end_time: '10:00' },
    { task_id: 4, date: today, start_time: '10:00', end_time: '11:00' },
    { task_id: 1, date: today, start_time: '14:00', end_time: '15:30' },
    { task_id: 8, date: today, start_time: '15:30', end_time: '16:00' },
    { task_id: 5, date: today, start_time: '16:00', end_time: '16:30' },
    { task_id: 9, date: today, start_time: '19:00', end_time: '20:00' },
    { task_id: 2, date: today, start_time: '21:00', end_time: '21:30' },
  ];
}

function persistTimeEntries(): void {
  try {
    localStorage.setItem(MOCK_TIME_ENTRIES_KEY, JSON.stringify(mockTimeEntries));
  } catch {}
}

export const mockTimeEntries: TaskTimeEntry[] = loadMockTimeEntries();

// heatmap: past 90 days with varying activity
const heatPattern = [2,0,3,1,4,2,0,1,3,2,4,1,0,3,2,1,4,2,3,0,1,2,4,3,1,0,2,3,1,4,2,0,3,2,4,1,3,0,2,1,4,3,2,0,1,3,2,4,2,0,3,1,4,2,1,3,4,2,0,3,1,2,4,3,0,2,1,3,4,1,2,0,3,1,4,2,0,3,1,2,4,3,0,1,2,3,4,2,1,0];
for (let i = 1; i <= 90; i++) {
  const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
  const count = heatPattern[(i - 1) % heatPattern.length];
  for (let j = 0; j < count; j++) {
    mockTasks.push({
      id: _nextTaskId++,
      title: `Task ${j + 1}`,
      description: null,
      category: 'work',
      date: dateStr,
      is_done: 1,
      repeat_daily: 0,
      series_id: null,
      repeat_end_date: null,
      created_at: dateStr,
      color: null,
    });
  }
}

// ---------- seed goals ----------

export const mockGoals: Goal[] = [
  { id: 1, title: 'Học tiếng Anh IELTS 7.0', description: 'Luyện thi 4 kỹ năng, thi thử mỗi tháng', category: 'learn', priority: 'high', year: 2026, quarter: 'Q3', status: 'todo', progress: 0, position: 0, created_at: today },
  { id: 2, title: 'Mua xe mới', description: 'Tiết kiệm đủ ngân sách, chọn model phù hợp', category: 'personal', priority: 'mid', year: 2026, quarter: 'Q4', status: 'todo', progress: 0, position: 1, created_at: today },
  { id: 3, title: 'Tham gia khóa thiền định', description: '10 ngày Vipassana', category: 'health', priority: 'low', year: 2026, quarter: 'Q2', status: 'todo', progress: 0, position: 2, created_at: today },
  { id: 4, title: 'Hoàn thiện portfolio cá nhân', description: 'Website giới thiệu dự án và kỹ năng', category: 'work', priority: 'mid', year: 2026, quarter: 'Q2', status: 'todo', progress: 0, position: 3, created_at: today },
  { id: 5, title: 'Tăng cân lên 70kg', description: 'Gym 4 buổi/tuần, chế độ dinh dưỡng', category: 'health', priority: 'high', year: 2026, quarter: 'Q3', status: 'doing', progress: 55, position: 0, created_at: today },
  { id: 6, title: 'Học Python & Data Science', description: 'Hoàn thành 3 khóa online, làm 2 project', category: 'learn', priority: 'high', year: 2026, quarter: 'Q4', status: 'doing', progress: 35, position: 1, created_at: today },
  { id: 7, title: 'Tiết kiệm 50 triệu', description: 'Đặt aside 5 triệu/tháng tự động', category: 'personal', priority: 'mid', year: 2026, quarter: 'full', status: 'doing', progress: 40, position: 2, created_at: today },
  { id: 8, title: 'Đọc 12 cuốn sách', description: 'Mỗi tháng 1 cuốn, ghi chú tóm tắt', category: 'personal', priority: 'low', year: 2026, quarter: 'full', status: 'review', progress: 75, position: 0, created_at: today },
  { id: 9, title: 'Ra mắt side project', description: 'App quản lý chi tiêu cá nhân', category: 'work', priority: 'high', year: 2026, quarter: 'Q2', status: 'review', progress: 85, position: 1, created_at: today },
  { id: 10, title: 'Lập kế hoạch tài chính năm', description: 'Ngân sách, đầu tư, quỹ khẩn cấp', category: 'personal', priority: 'high', year: 2026, quarter: 'Q1', status: 'done', progress: 100, position: 0, created_at: today },
  { id: 11, title: 'Khám sức khỏe định kỳ', description: 'Xét nghiệm tổng quát đầu năm', category: 'health', priority: 'low', year: 2026, quarter: 'Q1', status: 'done', progress: 100, position: 1, created_at: today },
  { id: 12, title: 'Setup môi trường làm việc', description: 'Màn hình, bàn phím cơ, microphone', category: 'work', priority: 'low', year: 2026, quarter: 'Q1', status: 'done', progress: 100, position: 2, created_at: today },
];

// ---------- seed checklist items ----------

let _nextChecklistId = 1;

export const mockChecklist: GoalChecklistItem[] = [
  // Goal 5 — Tăng cân 70kg (doing, 3/5 done)
  { id: _nextChecklistId++, goal_id: 5, text: 'Đăng ký gym', is_done: 1, position: 0 },
  { id: _nextChecklistId++, goal_id: 5, text: 'Lập chế độ ăn', is_done: 1, position: 1 },
  { id: _nextChecklistId++, goal_id: 5, text: 'Tập 4 buổi/tuần đủ 1 tháng', is_done: 1, position: 2 },
  { id: _nextChecklistId++, goal_id: 5, text: 'Đạt 65kg', is_done: 0, position: 3 },
  { id: _nextChecklistId++, goal_id: 5, text: 'Đạt 70kg', is_done: 0, position: 4 },
  // Goal 8 — Đọc 12 cuốn sách (review, 9/12 done)
  { id: _nextChecklistId++, goal_id: 8, text: 'Atomic Habits', is_done: 1, position: 0 },
  { id: _nextChecklistId++, goal_id: 8, text: 'Deep Work', is_done: 1, position: 1 },
  { id: _nextChecklistId++, goal_id: 8, text: 'The 4-Hour Workweek', is_done: 1, position: 2 },
  { id: _nextChecklistId++, goal_id: 8, text: 'Thinking, Fast and Slow', is_done: 1, position: 3 },
  { id: _nextChecklistId++, goal_id: 8, text: 'Man\'s Search for Meaning', is_done: 1, position: 4 },
  { id: _nextChecklistId++, goal_id: 8, text: 'The Power of Now', is_done: 1, position: 5 },
  { id: _nextChecklistId++, goal_id: 8, text: 'Ikigai', is_done: 1, position: 6 },
  { id: _nextChecklistId++, goal_id: 8, text: 'Sapiens', is_done: 1, position: 7 },
  { id: _nextChecklistId++, goal_id: 8, text: 'The Alchemist', is_done: 1, position: 8 },
  { id: _nextChecklistId++, goal_id: 8, text: '4000 Weeks', is_done: 0, position: 9 },
  { id: _nextChecklistId++, goal_id: 8, text: 'Psychology of Money', is_done: 0, position: 10 },
  { id: _nextChecklistId++, goal_id: 8, text: 'Essentialism', is_done: 0, position: 11 },
];

// ---------- in-memory ops ----------

export function dbGetTasks(date: string): Task[] {
  // Lazy-create instances for active series templates without one on this date
  const templates = mockTasks.filter(
    (t) =>
      t.repeat_daily === 1 &&
      t.series_id === null &&
      t.date < date &&
      (t.repeat_end_date === null || t.repeat_end_date >= date)
  );
  for (const tpl of templates) {
    const hasInstance = mockTasks.some((inst) => inst.series_id === tpl.id && inst.date === date);
    if (!hasInstance) {
      const instance: Task = {
        id: _nextTaskId++,
        title: tpl.title,
        description: null,
        category: tpl.category,
        date,
        is_done: 0,
        repeat_daily: 0,
        series_id: tpl.id,
        repeat_end_date: null,
        created_at: tpl.created_at,
        color: null,
      };
      mockTasks.push(instance);
      const tplTags = mockTaskTags[tpl.id];
      if (tplTags?.length) mockTaskTags[instance.id] = [...tplTags];
    }
  }
  return mockTasks.filter((t) => t.date === date).sort((a, b) => a.is_done - b.is_done || a.id - b.id);
}

export function dbAddTask(task: Omit<Task, 'id' | 'created_at'>): Task {
  const t: Task = { ...task, id: _nextTaskId++, created_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss') };
  mockTasks.push(t);
  return t;
}

export function dbUpdateTask(id: number, updates: Partial<Task>): void {
  const task = mockTasks.find((t) => t.id === id);
  if (!task) return;

  const isSeriesTask = task.repeat_daily === 1 || task.series_id != null;
  const templateId = task.series_id ?? (task.repeat_daily === 1 ? task.id : null);

  if (!isSeriesTask || !templateId) {
    Object.assign(task, updates);
    return;
  }

  const SERIES_FIELDS = new Set(['title', 'category']);
  const INSTANCE_FIELDS = new Set(['description', 'is_done']);

  const seriesUpdates = Object.fromEntries(Object.entries(updates).filter(([k]) => SERIES_FIELDS.has(k)));
  const instanceUpdates = Object.fromEntries(Object.entries(updates).filter(([k]) => INSTANCE_FIELDS.has(k)));

  if (Object.keys(seriesUpdates).length > 0) {
    const tpl = mockTasks.find((t) => t.id === templateId);
    if (tpl) Object.assign(tpl, seriesUpdates);
    for (const inst of mockTasks) {
      if (inst.series_id === templateId && inst.date >= task.date) Object.assign(inst, seriesUpdates);
    }
  }

  if (Object.keys(instanceUpdates).length > 0) Object.assign(task, instanceUpdates);

  // Handle repeat_daily toggle
  if ('repeat_daily' in updates) {
    if (updates.repeat_daily === 0 && task.repeat_daily === 1) {
      // Convert template to regular task and delete all instances
      const tpl = mockTasks.find((t) => t.id === templateId);
      if (tpl) {
        tpl.repeat_daily = 0;
        tpl.repeat_end_date = null;
      }
      for (let i = mockTasks.length - 1; i >= 0; i--) {
        if (mockTasks[i].series_id === templateId) {
          delete mockTaskTags[mockTasks[i].id];
          mockTasks.splice(i, 1);
        }
      }
    } else if (updates.repeat_daily === 1 && task.repeat_daily === 0 && task.series_id == null) {
      task.repeat_daily = 1;
    }
  }
}

export function dbDeleteTask(id: number): void {
  const task = mockTasks.find((t) => t.id === id);
  if (!task) return;

  const isSeriesTask = task.repeat_daily === 1 || task.series_id != null;
  const templateId = task.series_id ?? (task.repeat_daily === 1 ? task.id : null);

  if (isSeriesTask && templateId) {
    const tpl = mockTasks.find((t) => t.id === templateId);
    const templateStartDate = tpl?.date;

    if (!templateStartDate || task.date <= templateStartDate) {
      // Delete entire series
      const idsToDelete = new Set(
        mockTasks.filter((t) => t.id === templateId || t.series_id === templateId).map((t) => t.id)
      );
      for (const tid of idsToDelete) delete mockTaskTags[tid];
      for (let i = mockTasks.length - 1; i >= 0; i--) {
        if (idsToDelete.has(mockTasks[i].id)) mockTasks.splice(i, 1);
      }
    } else {
      // Stop series from task.date onwards
      const yesterday = format(subDays(new Date(task.date + 'T00:00:00'), 1), 'yyyy-MM-dd');
      if (tpl) tpl.repeat_end_date = yesterday;
      for (let i = mockTasks.length - 1; i >= 0; i--) {
        if (mockTasks[i].series_id === templateId && mockTasks[i].date >= task.date) {
          delete mockTaskTags[mockTasks[i].id];
          mockTasks.splice(i, 1);
        }
      }
    }
  } else {
    const idx = mockTasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      delete mockTaskTags[id];
      mockTasks.splice(idx, 1);
    }
  }
}

export function dbGetGoals(year: number): Goal[] {
  return mockGoals
    .filter((g) => g.year === year)
    .sort((a, b) => {
      const order = { todo: 0, doing: 1, review: 2, done: 3 };
      return order[a.status] - order[b.status] || a.position - b.position;
    });
}

export function dbAddGoal(goal: Omit<Goal, 'id' | 'created_at'>): Goal {
  const g: Goal = { ...goal, id: _nextGoalId++, created_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss') };
  mockGoals.push(g);
  return g;
}

export function dbUpdateGoal(id: number, updates: Partial<Goal>): void {
  const idx = mockGoals.findIndex((g) => g.id === id);
  if (idx !== -1) Object.assign(mockGoals[idx], updates);
}

export function dbDeleteGoal(id: number): void {
  const idx = mockGoals.findIndex((g) => g.id === id);
  if (idx !== -1) mockGoals.splice(idx, 1);
}

export function dbGetChecklistItems(goalId: number): GoalChecklistItem[] {
  return mockChecklist.filter((i) => i.goal_id === goalId).sort((a, b) => a.position - b.position);
}

export function dbGetAllChecklistItems(): GoalChecklistItem[] {
  return mockChecklist;
}

export function dbAddChecklistItem(goalId: number, text: string): GoalChecklistItem {
  const maxPos = mockChecklist.filter((i) => i.goal_id === goalId).reduce((m, i) => Math.max(m, i.position), -1);
  const item: GoalChecklistItem = { id: _nextChecklistId++, goal_id: goalId, text, is_done: 0, position: maxPos + 1 };
  mockChecklist.push(item);
  return item;
}

export function dbToggleChecklistItem(id: number): void {
  const item = mockChecklist.find((i) => i.id === id);
  if (item) item.is_done = item.is_done ? 0 : 1;
}

export function dbUpdateChecklistItem(id: number, text: string): void {
  const item = mockChecklist.find((i) => i.id === id);
  if (item) item.text = text;
}

export function dbDeleteChecklistItem(id: number): void {
  const idx = mockChecklist.findIndex((i) => i.id === id);
  if (idx !== -1) mockChecklist.splice(idx, 1);
}

export function dbDeleteChecklistItemsByGoal(goalId: number): void {
  for (let i = mockChecklist.length - 1; i >= 0; i--) {
    if (mockChecklist[i].goal_id === goalId) mockChecklist.splice(i, 1);
  }
}

export function dbGetCalendarTasks(startDate: string, endDate: string): Task[] {
  return mockTasks
    .filter((t) => t.date >= startDate && t.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function dbGetHeatmap(year: number): DayActivity[] {
  const map = new Map<string, number>();
  for (const t of mockTasks) {
    if (t.is_done && t.date.startsWith(String(year))) {
      map.set(t.date, (map.get(t.date) ?? 0) + 1);
    }
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

export function dbGetTimeEntries(date: string): TaskTimeEntry[] {
  return mockTimeEntries.filter((e) => e.date === date);
}

export function dbGetCalendarTimeEntries(startDate: string, endDate: string): TaskTimeEntry[] {
  return mockTimeEntries.filter((e) => e.date >= startDate && e.date <= endDate);
}

export function dbSaveTimeEntry(taskId: number, date: string, startTime: string, endTime: string): void {
  const idx = mockTimeEntries.findIndex((e) => e.task_id === taskId && e.date === date);
  if (idx !== -1) {
    mockTimeEntries[idx].start_time = startTime;
    mockTimeEntries[idx].end_time = endTime;
  } else {
    mockTimeEntries.push({ task_id: taskId, date, start_time: startTime, end_time: endTime });
  }
  persistTimeEntries();
}

export function dbDeleteTimeEntry(taskId: number, date: string): void {
  const idx = mockTimeEntries.findIndex((e) => e.task_id === taskId && e.date === date);
  if (idx !== -1) mockTimeEntries.splice(idx, 1);
  persistTimeEntries();
}

// ---------- tags ----------

let _nextTagId = 8;

export const mockTags: Tag[] = [
  { id: 1, name: 'Khẩn cấp',  color: '#F87171', created_at: today },
  { id: 2, name: 'Deep Work',  color: '#60A5FA', created_at: today },
  { id: 3, name: 'Họp',        color: '#A78BFA', created_at: today },
  { id: 4, name: 'Học tập',    color: '#34D399', created_at: today },
  { id: 5, name: 'Sức khỏe',   color: '#2DD4BF', created_at: today },
  { id: 6, name: 'Cá nhân',    color: '#FB923C', created_at: today },
  { id: 7, name: 'Nhanh',      color: '#FACC15', created_at: today },
];

// task_id → tag_ids
export const mockTaskTags: Record<number, number[]> = {
  1: [3, 1],    // Họp team:           Họp + Khẩn cấp
  2: [4, 6],    // Đọc sách:           Học tập + Cá nhân
  3: [5],       // Tập thể dục:        Sức khỏe
  4: [2, 1],    // Review code:        Deep Work + Khẩn cấp
  5: [7, 1],    // Gửi báo cáo:        Nhanh + Khẩn cấp
  6: [2, 4],    // Viết blog:          Deep Work + Học tập
  7: [5, 7],    // Thiền:              Sức khỏe + Nhanh
  8: [3, 2],    // Lên kế hoạch:       Họp + Deep Work
  9: [4],       // Học tiếng Anh:      Học tập
};

export function dbGetTags(): Tag[] {
  return [...mockTags];
}

export function dbAddTag(name: string, color: string): Tag {
  const tag: Tag = { id: _nextTagId++, name, color, created_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss') };
  mockTags.push(tag);
  return tag;
}

export function dbUpdateTag(id: number, name: string): void {
  const tag = mockTags.find((t) => t.id === id);
  if (tag) tag.name = name;
}

export function dbDeleteTag(id: number): void {
  const idx = mockTags.findIndex((t) => t.id === id);
  if (idx !== -1) mockTags.splice(idx, 1);
  for (const taskId of Object.keys(mockTaskTags)) {
    const tid = Number(taskId);
    mockTaskTags[tid] = (mockTaskTags[tid] ?? []).filter((tId) => tId !== id);
  }
}

export function dbGetTaskTagsForDate(date: string): Record<number, number[]> {
  const taskIds = new Set(mockTasks.filter((t) => t.date === date).map((t) => t.id));
  const result: Record<number, number[]> = {};
  for (const [taskId, tagIds] of Object.entries(mockTaskTags)) {
    const tid = Number(taskId);
    if (taskIds.has(tid)) result[tid] = [...tagIds];
  }
  return result;
}

export function dbGetCalendarTaskTags(startDate: string, endDate: string): Record<number, number[]> {
  const taskIds = new Set(
    mockTasks.filter((t) => t.date >= startDate && t.date <= endDate).map((t) => t.id)
  );
  const result: Record<number, number[]> = {};
  for (const [taskId, tagIds] of Object.entries(mockTaskTags)) {
    const tid = Number(taskId);
    if (taskIds.has(tid)) result[tid] = [...tagIds];
  }
  return result;
}

export function dbSetTaskTags(taskId: number, tagIds: number[]): void {
  const task = mockTasks.find((t) => t.id === taskId);
  const isSeriesTask = task && (task.repeat_daily === 1 || task.series_id != null);
  const templateId = task?.series_id ?? (task?.repeat_daily === 1 ? taskId : null);
  const fromDate = task?.date;

  if (isSeriesTask && templateId && fromDate) {
    // Update template + all instances from this date onwards
    const affected = mockTasks
      .filter((t) => t.id === templateId || (t.series_id === templateId && t.date >= fromDate))
      .map((t) => t.id);
    for (const id of affected) mockTaskTags[id] = [...tagIds];
  } else {
    mockTaskTags[taskId] = [...tagIds];
  }
}

export function dbGetStreak(): number {
  const dates = [...new Set(mockTasks.filter((t) => t.is_done).map((t) => t.date))].sort().reverse();
  if (!dates.length) return 0;
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const d of dates) {
    const date = new Date(d + 'T00:00:00');
    const diff = Math.round((cursor.getTime() - date.getTime()) / 86400000);
    if (diff > 1) break;
    streak++;
    cursor = date;
  }
  return streak;
}
