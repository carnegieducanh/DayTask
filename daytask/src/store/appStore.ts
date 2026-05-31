import { create } from 'zustand';
import { format } from 'date-fns';
import type { Task, Goal, NewTask, NewGoal, TaskUpdate, GoalUpdate, DayActivity, Tab, Theme } from '../types';
import {
  isTauri,
  dbGetTasks, dbAddTask, dbUpdateTask, dbDeleteTask,
  dbGetGoals, dbAddGoal, dbUpdateGoal, dbDeleteGoal,
  dbGetHeatmap, dbGetStreak,
} from './mockDb';

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb(): Promise<import('@tauri-apps/plugin-sql').default> {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:daytask.db');
  }
  return _db;
}

async function seedMockData(db: import('@tauri-apps/plugin-sql').default, today: string) {
  // Tasks hôm nay
  const tasks: Array<[string, string | null, string, string, string | null, string, number]> = [
    ['Họp team sprint planning', 'Discuss sprint goals and assign tickets', 'work', 'high', '14:00', today, 0],
    ['Đọc sách 30 phút', 'Atomic Habits — chương 7', 'personal', 'mid', '21:00', today, 0],
    ['Tập thể dục buổi sáng', 'Chạy bộ 5km + stretch', 'health', 'mid', '07:00', today, 1],
    ['Review code pull request', 'PR #42 — refactor auth module', 'work', 'high', '09:30', today, 1],
    ['Gửi báo cáo tuần', 'Tổng kết KPI tuần, gửi cho manager', 'work', 'mid', '11:00', today, 1],
  ];
  for (const t of tasks) {
    await db.execute(
      `INSERT INTO tasks (title, description, category, priority, reminder, date, is_done) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      t
    );
  }

  // Heatmap: tasks hoàn thành 90 ngày qua
  const todayDate = new Date(today + 'T00:00:00');
  const heatPattern = [2,0,3,1,4,2,0,1,3,2,4,1,0,3,2,1,4,2,3,0,1,2,4,3,1,0,2,3,1,4,2,0,3,2,4,1,3,0,2,1,4,3,2,0,1,3,2,4,2,0,3,1,4,2,1,3,4,2,0,3,1,2,4,3,0,2,1,3,4,1,2,0,3,1,4,2,0,3,1,2,4,3,0,1,2,3,4,2,1,0];
  for (let i = 1; i <= 90; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = heatPattern[(i - 1) % heatPattern.length];
    for (let j = 0; j < count; j++) {
      await db.execute(
        `INSERT INTO tasks (title, category, priority, date, is_done) VALUES ($1,$2,$3,$4,1)`,
        [`Task ${j + 1}`, 'work', 'mid', dateStr]
      );
    }
  }

  // Goals 2026
  const goals: Array<[string, string | null, string, string, number, string, string, number, number]> = [
    // [title, desc, category, priority, year, quarter, status, progress, position]
    ['Học tiếng Anh IELTS 7.0', 'Luyện thi 4 kỹ năng, thi thử mỗi tháng', 'learn', 'high', 2026, 'Q3', 'todo', 0, 0],
    ['Mua xe mới', 'Tiết kiệm đủ ngân sách, chọn model phù hợp', 'personal', 'mid', 2026, 'Q4', 'todo', 0, 1],
    ['Tham gia khóa thiền định', '10 ngày Vipassana', 'health', 'low', 2026, 'Q2', 'todo', 0, 2],
    ['Hoàn thiện portfolio cá nhân', 'Website giới thiệu dự án và kỹ năng', 'work', 'mid', 2026, 'Q2', 'todo', 0, 3],
    ['Tăng cân lên 70kg', 'Gym 4 buổi/tuần, chế độ dinh dưỡng', 'health', 'high', 2026, 'Q3', 'doing', 55, 0],
    ['Học Python & Data Science', 'Hoàn thành 3 khóa online, làm 2 project', 'learn', 'high', 2026, 'Q4', 'doing', 35, 1],
    ['Tiết kiệm 50 triệu', 'Đặt aside 5 triệu/tháng tự động', 'personal', 'mid', 2026, 'full', 'doing', 40, 2],
    ['Đọc 12 cuốn sách', 'Mỗi tháng 1 cuốn, ghi chú tóm tắt', 'personal', 'low', 2026, 'full', 'review', 75, 0],
    ['Ra mắt side project', 'App quản lý chi tiêu cá nhân', 'work', 'high', 2026, 'Q2', 'review', 85, 1],
    ['Lập kế hoạch tài chính năm', 'Ngân sách, đầu tư, quỹ khẩn cấp', 'personal', 'high', 2026, 'Q1', 'done', 100, 0],
    ['Khám sức khỏe định kỳ', 'Xét nghiệm tổng quát đầu năm', 'health', 'low', 2026, 'Q1', 'done', 100, 1],
    ['Setup môi trường làm việc', 'Màn hình, bàn phím cơ, microphone', 'work', 'low', 2026, 'Q1', 'done', 100, 2],
  ];
  for (const g of goals) {
    await db.execute(
      `INSERT INTO goals (title, description, category, priority, year, quarter, status, progress, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      g
    );
  }
}

interface AppState {
  activeTab: Tab;
  theme: Theme;
  tasks: Task[];
  goals: Goal[];
  heatmap: DayActivity[];
  selectedDate: string;
  selectedYear: number;
  loading: boolean;

  reminderPopup: Task | null;
  snoozedUntil: Record<number, number>;

  setActiveTab: (tab: Tab) => void;
  toggleTheme: () => void;
  setSelectedDate: (date: string) => void;
  setSelectedYear: (year: number) => void;
  setReminderPopup: (task: Task | null) => void;
  snoozeReminder: (taskId: number, minutes: number) => void;
  dismissReminder: () => void;

  loadTasks: (date: string) => Promise<void>;
  addTask: (task: NewTask) => Promise<void>;
  updateTask: (id: number, updates: TaskUpdate) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;

  loadGoals: (year: number) => Promise<void>;
  addGoal: (goal: NewGoal) => Promise<void>;
  updateGoal: (id: number, updates: GoalUpdate) => Promise<void>;
  moveGoal: (id: number, status: Goal['status'], position: number) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;

  loadHeatmap: (year: number) => Promise<void>;
  getStreak: () => Promise<number>;
  seedIfEmpty: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'today',
  theme: (localStorage.getItem('theme') as Theme) ?? 'light',
  tasks: [],
  goals: [],
  heatmap: [],
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  selectedYear: new Date().getFullYear(),
  loading: false,

  reminderPopup: null,
  snoozedUntil: {},

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleTheme: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    set({ theme: next });
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().loadTasks(date);
  },

  setSelectedYear: (year) => {
    set({ selectedYear: year });
    get().loadGoals(year);
  },

  setReminderPopup: (task) => set({ reminderPopup: task }),

  snoozeReminder: (taskId, minutes) => {
    const until = Date.now() + minutes * 60 * 1000;
    set((state) => ({
      snoozedUntil: { ...state.snoozedUntil, [taskId]: until },
      reminderPopup: null,
    }));
  },

  dismissReminder: () => set({ reminderPopup: null }),

  // --- Tasks ---

  loadTasks: async (date) => {
    if (!isTauri()) { set({ tasks: dbGetTasks(date) }); return; }
    const db = await getDb();
    const tasks = await db.select<Task[]>(
      'SELECT * FROM tasks WHERE date = $1 ORDER BY is_done ASC, created_at ASC',
      [date]
    );
    set({ tasks });
  },

  addTask: async (task) => {
    if (!isTauri()) {
      dbAddTask({ title: task.title, description: task.description ?? null, category: task.category, priority: task.priority, reminder: task.reminder ?? null, date: task.date, is_done: 0 });
      set({ tasks: dbGetTasks(get().selectedDate) });
      return;
    }
    const db = await getDb();
    await db.execute(
      `INSERT INTO tasks (title, description, category, priority, reminder, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [task.title, task.description ?? null, task.category, task.priority, task.reminder ?? null, task.date]
    );
    await get().loadTasks(get().selectedDate);
  },

  updateTask: async (id, updates) => {
    if (!isTauri()) {
      dbUpdateTask(id, updates);
      set({ tasks: dbGetTasks(get().selectedDate) });
      return;
    }
    const db = await getDb();
    const fields = Object.keys(updates) as (keyof TaskUpdate)[];
    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => updates[f]);
    await db.execute(
      `UPDATE tasks SET ${setClauses} WHERE id = $1`,
      [id, ...values]
    );
    await get().loadTasks(get().selectedDate);
  },

  toggleTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    await get().updateTask(id, { is_done: task.is_done ? 0 : 1 });
  },

  deleteTask: async (id) => {
    if (!isTauri()) {
      dbDeleteTask(id);
      set({ tasks: get().tasks.filter((t) => t.id !== id) });
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  },

  // --- Goals ---

  loadGoals: async (year) => {
    if (!isTauri()) { set({ goals: dbGetGoals(year) }); return; }
    const db = await getDb();
    const goals = await db.select<Goal[]>(
      'SELECT * FROM goals WHERE year = $1 ORDER BY status ASC, position ASC',
      [year]
    );
    set({ goals });
  },

  addGoal: async (goal) => {
    if (!isTauri()) {
      dbAddGoal({ title: goal.title, description: goal.description ?? null, category: goal.category, priority: goal.priority, year: goal.year, quarter: goal.quarter, status: goal.status ?? 'todo', progress: 0, position: dbGetGoals(goal.year).filter(g => g.status === (goal.status ?? 'todo')).length });
      set({ goals: dbGetGoals(get().selectedYear) });
      return;
    }
    const db = await getDb();
    await db.execute(
      `INSERT INTO goals (title, description, category, priority, year, quarter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [goal.title, goal.description ?? null, goal.category, goal.priority, goal.year, goal.quarter, goal.status ?? 'todo']
    );
    await get().loadGoals(get().selectedYear);
  },

  updateGoal: async (id, updates) => {
    if (!isTauri()) {
      dbUpdateGoal(id, updates);
      set({ goals: dbGetGoals(get().selectedYear) });
      return;
    }
    const db = await getDb();
    const fields = Object.keys(updates) as (keyof GoalUpdate)[];
    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => updates[f]);
    await db.execute(
      `UPDATE goals SET ${setClauses} WHERE id = $1`,
      [id, ...values]
    );
    await get().loadGoals(get().selectedYear);
  },

  moveGoal: async (id, status, position) => {
    await get().updateGoal(id, { status, position });
  },

  deleteGoal: async (id) => {
    if (!isTauri()) {
      dbDeleteGoal(id);
      set({ goals: get().goals.filter((g) => g.id !== id) });
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM goals WHERE id = $1', [id]);
    set({ goals: get().goals.filter((g) => g.id !== id) });
  },

  seedIfEmpty: async () => {
    if (!isTauri()) return; // mock data already in mockDb.ts
    const db = await getDb();
    const rows = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM tasks');
    if (rows[0].c > 0) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    await seedMockData(db, today);
    await get().loadTasks(get().selectedDate);
    await get().loadGoals(get().selectedYear);
  },

  // --- Heatmap ---

  loadHeatmap: async (year) => {
    if (!isTauri()) { set({ heatmap: dbGetHeatmap(year) }); return; }
    const db = await getDb();
    const rows = await db.select<DayActivity[]>(
      `SELECT date, COUNT(*) as count FROM tasks
       WHERE is_done = 1 AND date LIKE $1
       GROUP BY date`,
      [`${year}-%`]
    );
    set({ heatmap: rows });
  },

  getStreak: async () => {
    if (!isTauri()) return dbGetStreak();
    const db = await getDb();
    const rows = await db.select<{ date: string }[]>(
      `SELECT DISTINCT date FROM tasks WHERE is_done = 1 ORDER BY date DESC`
    );
    if (rows.length === 0) return 0;
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (const row of rows) {
      const d = new Date(row.date + 'T00:00:00');
      const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000);
      if (diff > 1) break;
      streak++;
      cursor = d;
    }
    return streak;
  },
}));
