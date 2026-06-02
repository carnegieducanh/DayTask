import { create } from 'zustand';
import { format } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import type { Task, Goal, NewTask, NewGoal, TaskUpdate, GoalUpdate, DayActivity, Tab, Theme, Language, GoalChecklistItem, Category, CategoryColors, TaskTimeEntry } from '../types';
import {
  isTauri,
  mockTasks, mockGoals, mockChecklist,
  dbGetTasks, dbAddTask, dbUpdateTask, dbDeleteTask,
  dbGetGoals, dbAddGoal, dbUpdateGoal, dbDeleteGoal,
  dbGetAllChecklistItems, dbAddChecklistItem, dbToggleChecklistItem, dbDeleteChecklistItem, dbDeleteChecklistItemsByGoal,
  dbGetHeatmap, dbGetStreak, dbGetCalendarTasks,
  dbGetTimeEntries, dbGetCalendarTimeEntries, dbSaveTimeEntry, dbDeleteTimeEntry,
} from './mockDb';

const DEFAULT_CATEGORY_COLORS: CategoryColors = {
  work:         '#7DD3FC',
  personal:     '#86EFAC',
  health:       '#FDBA74',
  learn:        '#C4B5FD',
  creative:     '#F9A8D4',
  mindfulness:  '#6EE7B7',
};

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb(): Promise<import('@tauri-apps/plugin-sql').default> {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}

async function seedMockData(db: import('@tauri-apps/plugin-sql').default, today: string) {
  // Tasks hôm nay
  const tasks: Array<[string, string | null, string, string, number]> = [
    ['Họp team sprint planning', 'Discuss sprint goals and assign tickets', 'work', today, 0],
    ['Đọc sách 30 phút', 'Atomic Habits — chương 7', 'personal', today, 0],
    ['Tập thể dục buổi sáng', 'Chạy bộ 5km + stretch', 'health', today, 1],
    ['Review code pull request', 'PR #42 — refactor auth module', 'work', today, 1],
    ['Gửi báo cáo tuần', 'Tổng kết KPI tuần, gửi cho manager', 'work', today, 1],
  ];
  for (const t of tasks) {
    await db.execute(
      `INSERT INTO tasks (title, description, category, date, is_done) VALUES ($1,$2,$3,$4,$5)`,
      t
    );
  }
  // Seed time entries cho 2 task đầu
  const rows = await db.select<{ id: number; title: string }[]>(
    `SELECT id, title FROM tasks WHERE date = $1 ORDER BY created_at ASC LIMIT 5`,
    [today]
  );
  const timeMap: Record<string, [string, string]> = {
    'Họp team sprint planning': ['14:00', '15:30'],
    'Đọc sách 30 phút': ['21:00', '21:30'],
  };
  for (const row of rows) {
    const times = timeMap[row.title];
    if (times) {
      await db.execute(
        `INSERT INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)`,
        [row.id, today, times[0], times[1]]
      );
    }
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
        `INSERT INTO tasks (title, category, date, is_done) VALUES ($1,$2,$3,1)`,
        [`Task ${j + 1}`, 'work', dateStr]
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
  calendarTasks: Task[];
  taskTimeEntries: TaskTimeEntry[];
  calendarTimeEntries: TaskTimeEntry[];
  goals: Goal[];
  checklistItems: Record<number, GoalChecklistItem[]>;
  heatmap: DayActivity[];
  selectedDate: string;
  selectedYear: number;
  loading: boolean;

  reminderPopup: Task | null;
  snoozedUntil: Record<number, number>;
  openAddGoalModal: boolean;
  uiScale: number;
  openSettingsModal: boolean;
  kanbanDragActiveId: number | null;
  categoryColors: CategoryColors;
  language: Language;
  pendingDeleteTask: Task | null;
  pendingDeleteGoal: Goal | null;
  autostart: boolean;

  setActiveTab: (tab: Tab) => void;
  toggleTheme: () => void;
  setUiScale: (scale: number) => void;
  setLanguage: (lang: Language) => void;
  setOpenSettingsModal: (val: boolean) => void;
  setSelectedDate: (date: string) => void;
  setSelectedYear: (year: number) => void;
  setReminderPopup: (task: Task | null) => void;
  snoozeReminder: (taskId: number, minutes: number) => void;
  dismissReminder: () => void;
  setOpenAddGoalModal: (val: boolean) => void;
  setKanbanDragActiveId: (id: number | null) => void;
  initAutostart: () => Promise<void>;
  setAutostart: (v: boolean) => Promise<void>;

  loadTasks: (date: string) => Promise<void>;
  loadCalendarTasks: (startDate: string, endDate: string) => Promise<void>;
  loadTimeEntries: (date: string) => Promise<void>;
  saveTimeEntry: (taskId: number, date: string, startTime: string, endTime: string) => Promise<void>;
  deleteTimeEntry: (taskId: number, date: string) => Promise<void>;
  addTask: (task: NewTask, timeEntry?: { startTime: string; endTime: string }) => Promise<void>;
  updateTask: (id: number, updates: TaskUpdate) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  softDeleteTask: (id: number) => void;
  undoDeleteTask: () => void;
  confirmDeleteTask: (task: Task) => Promise<void>;

  loadCategoryColors: () => Promise<void>;
  updateCategoryColor: (category: Category, color: string) => Promise<void>;

  loadGoals: (year: number) => Promise<void>;
  addGoal: (goal: NewGoal) => Promise<void>;
  updateGoal: (id: number, updates: GoalUpdate) => Promise<void>;
  reorderGoal: (activeId: number, newStatus: Goal['status'], newIndex: number) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  softDeleteGoal: (id: number) => void;
  undoDeleteGoal: () => void;
  confirmDeleteGoal: (goal: Goal) => Promise<void>;

  addChecklistItem: (goalId: number, text: string) => Promise<void>;
  toggleChecklistItem: (itemId: number, goalId: number) => Promise<void>;
  deleteChecklistItem: (itemId: number, goalId: number) => Promise<void>;

  loadHeatmap: (year: number) => Promise<void>;
  getStreak: () => Promise<number>;
  seedIfEmpty: () => Promise<void>;
  exportAllData: () => Promise<void>;
  importAllData: (file: File) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'today',
  theme: (localStorage.getItem('theme') as Theme) ?? 'light',
  tasks: [],
  calendarTasks: [],
  taskTimeEntries: [],
  calendarTimeEntries: [],
  goals: [],
  checklistItems: {},
  heatmap: [],
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  selectedYear: new Date().getFullYear(),
  loading: false,

  reminderPopup: null,
  snoozedUntil: {},
  openAddGoalModal: false,
  uiScale: parseFloat(localStorage.getItem('uiScale') ?? '1.1'),
  openSettingsModal: false,
  kanbanDragActiveId: null,
  categoryColors: { ...DEFAULT_CATEGORY_COLORS },
  language: (localStorage.getItem('language') as Language) ?? 'vi',
  pendingDeleteTask: null,
  pendingDeleteGoal: null,
  autostart: true,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setUiScale: (scale) => {
    localStorage.setItem('uiScale', String(scale));
    set({ uiScale: scale });
  },

  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    set({ language: lang });
  },

  setOpenSettingsModal: (val) => set({ openSettingsModal: val }),

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
  setOpenAddGoalModal: (val) => set({ openAddGoalModal: val }),
  setKanbanDragActiveId: (id) => set({ kanbanDragActiveId: id }),

  initAutostart: async () => {
    if (!isTauri()) return;
    const firstRun = !localStorage.getItem('autostartInitialized');
    if (firstRun) {
      await invoke('plugin:autostart|enable');
      localStorage.setItem('autostartInitialized', '1');
      set({ autostart: true });
    } else {
      const enabled = await invoke<boolean>('plugin:autostart|is_enabled');
      set({ autostart: enabled });
    }
  },

  setAutostart: async (v) => {
    set({ autostart: v });
    if (!isTauri()) return;
    if (v) {
      await invoke('plugin:autostart|enable');
    } else {
      await invoke('plugin:autostart|disable');
    }
  },

  // --- Tasks ---

  loadTasks: async (date) => {
    if (!isTauri()) {
      set({ tasks: dbGetTasks(date), taskTimeEntries: dbGetTimeEntries(date) });
      return;
    }
    const db = await getDb();
    // Roll undone recurring tasks from past dates (skip if a copy for today already exists with same title)
    await db.execute(
      `UPDATE tasks SET date = $1
       WHERE repeat_daily = 1 AND is_done = 0 AND date < $1
       AND title NOT IN (SELECT title FROM tasks WHERE repeat_daily = 1 AND date = $1 AND is_done = 0)`,
      [date]
    );
    const tasks = await db.select<Task[]>(
      'SELECT id, title, description, category, date, is_done, repeat_daily, created_at FROM tasks WHERE date = $1 ORDER BY is_done ASC, created_at ASC',
      [date]
    );
    const taskTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date = $1',
      [date]
    );
    set({ tasks, taskTimeEntries });
  },

  loadCalendarTasks: async (startDate, endDate) => {
    if (!isTauri()) {
      set({
        calendarTasks: dbGetCalendarTasks(startDate, endDate),
        calendarTimeEntries: dbGetCalendarTimeEntries(startDate, endDate),
      });
      return;
    }
    const db = await getDb();
    const tasks = await db.select<Task[]>(
      'SELECT id, title, description, category, date, is_done, repeat_daily, created_at FROM tasks WHERE is_done = 1 AND date >= $1 AND date <= $2 ORDER BY date ASC',
      [startDate, endDate]
    );
    const calendarTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date >= $1 AND date <= $2',
      [startDate, endDate]
    );
    set({ calendarTasks: tasks, calendarTimeEntries });
  },

  loadTimeEntries: async (date) => {
    if (!isTauri()) {
      set({ taskTimeEntries: dbGetTimeEntries(date) });
      return;
    }
    const db = await getDb();
    const taskTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date = $1',
      [date]
    );
    set({ taskTimeEntries });
  },

  saveTimeEntry: async (taskId, date, startTime, endTime) => {
    const newEntry: TaskTimeEntry = { task_id: taskId, date, start_time: startTime, end_time: endTime };
    const updatedCalendarEntries = [
      ...get().calendarTimeEntries.filter((e) => !(e.task_id === taskId && e.date === date)),
      newEntry,
    ];
    if (!isTauri()) {
      dbSaveTimeEntry(taskId, date, startTime, endTime);
      set({ taskTimeEntries: dbGetTimeEntries(date), calendarTimeEntries: updatedCalendarEntries });
      return;
    }
    const db = await getDb();
    await db.execute(
      'INSERT OR REPLACE INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
      [taskId, date, startTime, endTime]
    );
    const taskTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date = $1',
      [date]
    );
    set({ taskTimeEntries, calendarTimeEntries: updatedCalendarEntries });
  },

  deleteTimeEntry: async (taskId, date) => {
    const updatedCalendarEntries = get().calendarTimeEntries.filter(
      (e) => !(e.task_id === taskId && e.date === date)
    );
    if (!isTauri()) {
      dbDeleteTimeEntry(taskId, date);
      set({ taskTimeEntries: dbGetTimeEntries(date), calendarTimeEntries: updatedCalendarEntries });
      return;
    }
    const db = await getDb();
    await db.execute(
      'DELETE FROM task_time_entries WHERE task_id = $1 AND date = $2',
      [taskId, date]
    );
    const taskTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date = $1',
      [date]
    );
    set({ taskTimeEntries, calendarTimeEntries: updatedCalendarEntries });
  },

  addTask: async (task, timeEntry) => {
    if (!isTauri()) {
      const newTask = dbAddTask({ title: task.title, description: task.description ?? null, category: task.category, date: task.date, is_done: 0, repeat_daily: task.repeat_daily ?? 0 });
      if (timeEntry) dbSaveTimeEntry(newTask.id, task.date, timeEntry.startTime, timeEntry.endTime);
      set({ tasks: dbGetTasks(get().selectedDate), taskTimeEntries: dbGetTimeEntries(get().selectedDate) });
      return;
    }
    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO tasks (title, description, category, date, repeat_daily) VALUES ($1, $2, $3, $4, $5)`,
      [task.title, task.description ?? null, task.category, task.date, task.repeat_daily ?? 0]
    );
    if (timeEntry && result.lastInsertId) {
      await db.execute(
        'INSERT OR REPLACE INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
        [result.lastInsertId, task.date, timeEntry.startTime, timeEntry.endTime]
      );
    }
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
    const newDone = task.is_done ? 0 : 1;

    if (!isTauri()) {
      dbUpdateTask(id, { is_done: newDone });
      // Tạo bản copy cho ngày mai khi đánh dấu done một recurring task
      if (newDone === 1 && task.repeat_daily === 1) {
        const nextDate = new Date(task.date + 'T00:00:00');
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = format(nextDate, 'yyyy-MM-dd');
        const alreadyExists = mockTasks.some(
          (t) => t.repeat_daily === 1 && t.is_done === 0 && t.date === nextDateStr && t.title === task.title
        );
        if (!alreadyExists) {
          dbAddTask({ title: task.title, description: task.description, category: task.category, date: nextDateStr, is_done: 0, repeat_daily: 1 });
        }
      }
      set({ tasks: dbGetTasks(get().selectedDate) });
      return;
    }

    const db = await getDb();
    await db.execute('UPDATE tasks SET is_done = $1 WHERE id = $2', [newDone, id]);
    // Tạo bản copy cho ngày mai khi đánh dấu done một recurring task
    if (newDone === 1 && task.repeat_daily === 1) {
      const nextDate = new Date(task.date + 'T00:00:00');
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = format(nextDate, 'yyyy-MM-dd');
      await db.execute(
        `INSERT INTO tasks (title, description, category, date, repeat_daily)
         SELECT $1, $2, $3, $4, 1
         WHERE NOT EXISTS (
           SELECT 1 FROM tasks WHERE repeat_daily = 1 AND is_done = 0 AND date = $4 AND title = $1
         )`,
        [task.title, task.description, task.category, nextDateStr]
      );
    }
    await get().loadTasks(get().selectedDate);
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

  softDeleteTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    // If there's already a pending delete, confirm it immediately before queuing new one
    const prev = get().pendingDeleteTask;
    if (prev) {
      get().confirmDeleteTask(prev);
    }
    set({ tasks: get().tasks.filter((t) => t.id !== id), pendingDeleteTask: task });
  },

  undoDeleteTask: () => {
    const task = get().pendingDeleteTask;
    if (!task) return;
    // Re-insert in original position (by created_at order)
    const tasks = [...get().tasks, task].sort((a, b) =>
      a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0
    );
    set({ tasks, pendingDeleteTask: null });
  },

  confirmDeleteTask: async (task) => {
    set({ pendingDeleteTask: null });
    if (!isTauri()) {
      dbDeleteTask(task.id);
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM tasks WHERE id = $1', [task.id]);
  },

  // --- Category Colors ---

  loadCategoryColors: async () => {
    if (!isTauri()) {
      const stored = localStorage.getItem('categoryColors');
      if (stored) {
        try { set({ categoryColors: JSON.parse(stored) }); } catch {}
      }
      return;
    }
    const db = await getDb();
    const rows = await db.select<{ category: string; color: string }[]>(
      'SELECT category, color FROM category_colors'
    );
    const colors: CategoryColors = { ...DEFAULT_CATEGORY_COLORS };
    for (const row of rows) {
      colors[row.category as Category] = row.color;
    }
    set({ categoryColors: colors });
  },

  updateCategoryColor: async (category, color) => {
    const newColors = { ...get().categoryColors, [category]: color };
    set({ categoryColors: newColors });
    if (!isTauri()) {
      localStorage.setItem('categoryColors', JSON.stringify(newColors));
      return;
    }
    const db = await getDb();
    await db.execute(
      'INSERT OR REPLACE INTO category_colors (category, color) VALUES ($1, $2)',
      [category, color]
    );
  },

  // --- Goals ---

  loadGoals: async (year) => {
    if (!isTauri()) {
      const allItems = dbGetAllChecklistItems();
      const byGoal: Record<number, GoalChecklistItem[]> = {};
      for (const item of allItems) {
        if (!byGoal[item.goal_id]) byGoal[item.goal_id] = [];
        byGoal[item.goal_id].push(item);
      }
      set({ goals: dbGetGoals(year), checklistItems: byGoal });
      return;
    }
    const db = await getDb();
    const goals = await db.select<Goal[]>(
      'SELECT * FROM goals WHERE year = $1 ORDER BY status ASC, position ASC',
      [year]
    );
    const allItems = await db.select<GoalChecklistItem[]>(
      'SELECT * FROM goal_checklist_items ORDER BY goal_id, position ASC'
    );
    const byGoal: Record<number, GoalChecklistItem[]> = {};
    for (const item of allItems) {
      if (!byGoal[item.goal_id]) byGoal[item.goal_id] = [];
      byGoal[item.goal_id].push(item);
    }
    set({ goals, checklistItems: byGoal });
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

  // Kéo thả Kanban: chèn card vào newIndex của cột đích rồi ĐÁNH SỐ LẠI
  // position 0..n cho cả cột đích (và cột nguồn nếu đổi cột). Trước đây chỉ gán
  // position = position của card đích nên 2 card trùng số → thứ tự nhảy lung tung.
  reorderGoal: async (activeId, newStatus, newIndex) => {
    const goals = get().goals;
    const active = goals.find((g) => g.id === activeId);
    if (!active) return;
    const oldStatus = active.status;

    // Thứ tự id cột đích (loại card đang kéo), rồi chèn vào newIndex đã clamp
    const targetIds = goals
      .filter((g) => g.status === newStatus && g.id !== activeId)
      .sort((a, b) => a.position - b.position)
      .map((g) => g.id);
    const idx = Math.max(0, Math.min(newIndex, targetIds.length));
    targetIds.splice(idx, 0, activeId);

    const updates: { id: number; status: Goal['status']; position: number }[] =
      targetIds.map((id, i) => ({ id, status: newStatus, position: i }));

    // Đổi cột → đánh số lại cột nguồn cho liền mạch
    if (oldStatus !== newStatus) {
      goals
        .filter((g) => g.status === oldStatus && g.id !== activeId)
        .sort((a, b) => a.position - b.position)
        .forEach((g, i) => updates.push({ id: g.id, status: oldStatus, position: i }));
    }

    // Optimistic update — tránh giật/nhảy, không cần reload từ DB
    const byId = new Map(updates.map((u) => [u.id, u]));
    set({
      goals: goals.map((g) =>
        byId.has(g.id)
          ? { ...g, status: byId.get(g.id)!.status, position: byId.get(g.id)!.position }
          : g
      ),
    });

    // Lưu xuống DB
    if (!isTauri()) {
      for (const u of updates) dbUpdateGoal(u.id, { status: u.status, position: u.position });
      return;
    }
    const db = await getDb();
    for (const u of updates) {
      await db.execute('UPDATE goals SET status = $1, position = $2 WHERE id = $3', [
        u.status,
        u.position,
        u.id,
      ]);
    }
  },

  deleteGoal: async (id) => {
    if (!isTauri()) {
      dbDeleteChecklistItemsByGoal(id);
      dbDeleteGoal(id);
      const { [id]: _, ...rest } = get().checklistItems;
      set({ goals: get().goals.filter((g) => g.id !== id), checklistItems: rest });
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE goal_id = $1', [id]);
    await db.execute('DELETE FROM goals WHERE id = $1', [id]);
    const { [id]: _, ...rest } = get().checklistItems;
    set({ goals: get().goals.filter((g) => g.id !== id), checklistItems: rest });
  },

  softDeleteGoal: (id) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;
    const prev = get().pendingDeleteGoal;
    if (prev) get().confirmDeleteGoal(prev);
    const { [id]: _, ...restChecklist } = get().checklistItems;
    set({
      goals: get().goals.filter((g) => g.id !== id),
      checklistItems: restChecklist,
      pendingDeleteGoal: goal,
    });
  },

  undoDeleteGoal: () => {
    const goal = get().pendingDeleteGoal;
    if (!goal) return;
    const goals = [...get().goals, goal].sort((a, b) => a.position - b.position);
    set({ goals, pendingDeleteGoal: null });
  },

  confirmDeleteGoal: async (goal) => {
    set({ pendingDeleteGoal: null });
    if (!isTauri()) {
      dbDeleteChecklistItemsByGoal(goal.id);
      dbDeleteGoal(goal.id);
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE goal_id = $1', [goal.id]);
    await db.execute('DELETE FROM goals WHERE id = $1', [goal.id]);
  },

  addChecklistItem: async (goalId, text) => {
    if (!isTauri()) {
      const item = dbAddChecklistItem(goalId, text);
      const prev = get().checklistItems[goalId] ?? [];
      set({ checklistItems: { ...get().checklistItems, [goalId]: [...prev, item] } });
      return;
    }
    const db = await getDb();
    const prev = get().checklistItems[goalId] ?? [];
    const position = prev.length;
    await db.execute(
      'INSERT INTO goal_checklist_items (goal_id, text, is_done, position) VALUES ($1, $2, 0, $3)',
      [goalId, text, position]
    );
    const items = await db.select<GoalChecklistItem[]>(
      'SELECT * FROM goal_checklist_items WHERE goal_id = $1 ORDER BY position ASC',
      [goalId]
    );
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
  },

  toggleChecklistItem: async (itemId, goalId) => {
    if (!isTauri()) {
      dbToggleChecklistItem(itemId);
      const items = (get().checklistItems[goalId] ?? []).map((i) =>
        i.id === itemId ? { ...i, is_done: i.is_done ? 0 : 1 } : i
      );
      set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
      return;
    }
    const db = await getDb();
    const item = (get().checklistItems[goalId] ?? []).find((i) => i.id === itemId);
    if (!item) return;
    await db.execute(
      'UPDATE goal_checklist_items SET is_done = $1 WHERE id = $2',
      [item.is_done ? 0 : 1, itemId]
    );
    const items = (get().checklistItems[goalId] ?? []).map((i) =>
      i.id === itemId ? { ...i, is_done: i.is_done ? 0 : 1 } : i
    );
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
  },

  deleteChecklistItem: async (itemId, goalId) => {
    if (!isTauri()) {
      dbDeleteChecklistItem(itemId);
      const items = (get().checklistItems[goalId] ?? []).filter((i) => i.id !== itemId);
      set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE id = $1', [itemId]);
    const items = (get().checklistItems[goalId] ?? []).filter((i) => i.id !== itemId);
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
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

  // --- Export / Import toàn bộ dữ liệu ---

  exportAllData: async () => {
    let tasks: Task[];
    let goals: Goal[];
    let checklistItems: GoalChecklistItem[];
    let categoryColors: CategoryColors;

    if (!isTauri()) {
      tasks = [...mockTasks];
      goals = [...mockGoals];
      checklistItems = dbGetAllChecklistItems();
      const stored = localStorage.getItem('categoryColors');
      categoryColors = stored ? JSON.parse(stored) : { ...DEFAULT_CATEGORY_COLORS };
    } else {
      const db = await getDb();
      tasks = await db.select<Task[]>('SELECT * FROM tasks ORDER BY date ASC, created_at ASC');
      goals = await db.select<Goal[]>('SELECT * FROM goals ORDER BY year ASC, status ASC, position ASC');
      checklistItems = await db.select<GoalChecklistItem[]>('SELECT * FROM goal_checklist_items ORDER BY goal_id, position ASC');
      const colorRows = await db.select<{ category: string; color: string }[]>('SELECT category, color FROM category_colors');
      categoryColors = { ...DEFAULT_CATEGORY_COLORS };
      for (const row of colorRows) {
        categoryColors[row.category as Category] = row.color;
      }
    }

    const payload = { version: '1.0', exportedAt: new Date().toISOString(), tasks, goals, checklistItems, categoryColors };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atomic-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importAllData: async (file: File) => {
    const text = await file.text();
    let data: { tasks?: Task[]; goals?: Goal[]; checklistItems?: GoalChecklistItem[]; categoryColors?: CategoryColors };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('File không hợp lệ — không thể đọc JSON');
    }
    if (!Array.isArray(data.tasks) || !Array.isArray(data.goals) || !Array.isArray(data.checklistItems)) {
      throw new Error('File không hợp lệ — thiếu trường tasks / goals / checklistItems');
    }

    if (!isTauri()) {
      mockTasks.length = 0;
      mockGoals.length = 0;
      mockChecklist.length = 0;
      mockTasks.push(...data.tasks);
      mockGoals.push(...data.goals);
      mockChecklist.push(...data.checklistItems);
      if (data.categoryColors) {
        localStorage.setItem('categoryColors', JSON.stringify(data.categoryColors));
      }
    } else {
      const db = await getDb();
      await db.execute('DELETE FROM goal_checklist_items');
      await db.execute('DELETE FROM tasks');
      await db.execute('DELETE FROM goals');
      await db.execute('DELETE FROM category_colors');

      for (const t of data.tasks) {
        await db.execute(
          `INSERT INTO tasks (id, title, description, category, date, is_done, repeat_daily, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [t.id, t.title, t.description ?? null, t.category, t.date, t.is_done, t.repeat_daily ?? 0, t.created_at]
        );
      }
      for (const g of data.goals) {
        await db.execute(
          `INSERT INTO goals (id, title, description, category, priority, year, quarter, status, progress, position, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [g.id, g.title, g.description ?? null, g.category, g.priority, g.year, g.quarter, g.status, g.progress, g.position, g.created_at]
        );
      }
      for (const ci of data.checklistItems) {
        await db.execute(
          `INSERT INTO goal_checklist_items (id, goal_id, text, is_done, position) VALUES ($1,$2,$3,$4,$5)`,
          [ci.id, ci.goal_id, ci.text, ci.is_done, ci.position]
        );
      }
      if (data.categoryColors) {
        for (const [cat, color] of Object.entries(data.categoryColors)) {
          await db.execute('INSERT OR REPLACE INTO category_colors (category, color) VALUES ($1, $2)', [cat, color]);
        }
      }
    }

    await get().loadTasks(get().selectedDate);
    await get().loadGoals(get().selectedYear);
    await get().loadHeatmap(get().selectedYear);
    await get().loadCategoryColors();
  },
}));
