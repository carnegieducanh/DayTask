import { create } from 'zustand';
import Database from '@tauri-apps/plugin-sql';
import { format } from 'date-fns';
import type { Task, Goal, NewTask, NewGoal, TaskUpdate, GoalUpdate, DayActivity, Tab, Theme } from '../types';

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await Database.load('sqlite:daytask.db');
  }
  return _db;
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
    const db = await getDb();
    const tasks = await db.select<Task[]>(
      'SELECT * FROM tasks WHERE date = $1 ORDER BY is_done ASC, created_at ASC',
      [date]
    );
    set({ tasks });
  },

  addTask: async (task) => {
    const db = await getDb();
    await db.execute(
      `INSERT INTO tasks (title, description, category, priority, reminder, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [task.title, task.description ?? null, task.category, task.priority, task.reminder ?? null, task.date]
    );
    await get().loadTasks(get().selectedDate);
  },

  updateTask: async (id, updates) => {
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
    const db = await getDb();
    await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  },

  // --- Goals ---

  loadGoals: async (year) => {
    const db = await getDb();
    const goals = await db.select<Goal[]>(
      'SELECT * FROM goals WHERE year = $1 ORDER BY status ASC, position ASC',
      [year]
    );
    set({ goals });
  },

  addGoal: async (goal) => {
    const db = await getDb();
    await db.execute(
      `INSERT INTO goals (title, description, category, priority, year, quarter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [goal.title, goal.description ?? null, goal.category, goal.priority, goal.year, goal.quarter, goal.status ?? 'todo']
    );
    await get().loadGoals(get().selectedYear);
  },

  updateGoal: async (id, updates) => {
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
    const db = await getDb();
    await db.execute('DELETE FROM goals WHERE id = $1', [id]);
    set({ goals: get().goals.filter((g) => g.id !== id) });
  },

  // --- Heatmap ---

  loadHeatmap: async (year) => {
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
