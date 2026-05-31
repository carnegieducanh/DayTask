// In-memory mock database used when running in browser (no Tauri/SQLite)
import { format, subDays } from 'date-fns';
import type { Task, Goal, DayActivity } from '../types';

export const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let _nextTaskId = 200;
let _nextGoalId = 100;

const today = format(new Date(), 'yyyy-MM-dd');

// ---------- seed tasks ----------

export const mockTasks: Task[] = [
  { id: 1, title: 'Họp team sprint planning', description: 'Discuss sprint goals and assign tickets', category: 'work', priority: 'high', reminder: '14:00', date: today, is_done: 0, created_at: today },
  { id: 2, title: 'Đọc sách 30 phút', description: 'Atomic Habits — chương 7', category: 'personal', priority: 'mid', reminder: '21:00', date: today, is_done: 0, created_at: today },
  { id: 3, title: 'Tập thể dục buổi sáng', description: 'Chạy bộ 5km + stretch', category: 'health', priority: 'mid', reminder: '07:00', date: today, is_done: 1, created_at: today },
  { id: 4, title: 'Review code pull request', description: 'PR #42 — refactor auth module', category: 'work', priority: 'high', reminder: '09:30', date: today, is_done: 1, created_at: today },
  { id: 5, title: 'Gửi báo cáo tuần', description: 'Tổng kết KPI tuần, gửi cho manager', category: 'work', priority: 'mid', reminder: '11:00', date: today, is_done: 1, created_at: today },
];

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
      priority: 'mid',
      reminder: null,
      date: dateStr,
      is_done: 1,
      created_at: dateStr,
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

// ---------- in-memory ops ----------

export function dbGetTasks(date: string): Task[] {
  return mockTasks
    .filter((t) => t.date === date)
    .sort((a, b) => a.is_done - b.is_done || a.id - b.id);
}

export function dbAddTask(task: Omit<Task, 'id' | 'created_at'>): Task {
  const t: Task = { ...task, id: _nextTaskId++, created_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss') };
  mockTasks.push(t);
  return t;
}

export function dbUpdateTask(id: number, updates: Partial<Task>): void {
  const idx = mockTasks.findIndex((t) => t.id === id);
  if (idx !== -1) Object.assign(mockTasks[idx], updates);
}

export function dbDeleteTask(id: number): void {
  const idx = mockTasks.findIndex((t) => t.id === id);
  if (idx !== -1) mockTasks.splice(idx, 1);
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

export function dbGetHeatmap(year: number): DayActivity[] {
  const map = new Map<string, number>();
  for (const t of mockTasks) {
    if (t.is_done && t.date.startsWith(String(year))) {
      map.set(t.date, (map.get(t.date) ?? 0) + 1);
    }
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
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
