import { create } from 'zustand';
import { format, subDays } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import type { Task, Goal, NewTask, NewGoal, TaskUpdate, GoalUpdate, DayActivity, DayDuration, TagStat, MonthStat, Tab, Theme, Language, AccentColor, GoalChecklistItem, Category, CategoryColors, TaskTimeEntry, Tag } from '../types';
import {
  isTauri,
  mockTasks, mockGoals, mockChecklist, mockTags, mockTaskTags, mockTimeEntries,
  dbGetTasks, dbAddTask, dbUpdateTask, dbDeleteTask,
  dbGetGoals, dbAddGoal, dbUpdateGoal, dbDeleteGoal,
  dbGetAllChecklistItems, dbAddChecklistItem, dbToggleChecklistItem, dbUpdateChecklistItem, dbDeleteChecklistItem, dbDeleteChecklistItemsByGoal,
  dbGetHeatmap, dbGetStreak, dbGetCalendarTasks,
  dbGetTimeEntries, dbGetCalendarTimeEntries, dbSaveTimeEntry, dbDeleteTimeEntry,
  dbGetTags, dbAddTag, dbUpdateTag, dbDeleteTag, dbGetTaskTagsForDate, dbSetTaskTags, dbGetCalendarTaskTags,
} from './mockDb';

const TAG_COLORS = [
  '#60A5FA', '#34D399', '#FB923C', '#A78BFA',
  '#F472B6', '#2DD4BF', '#FACC15', '#818CF8',
  '#4ADE80', '#F87171', '#E879F9', '#38BDF8',
];

const DEFAULT_CATEGORY_COLORS: CategoryColors = {
  work:         '#7DD3FC',
  personal:     '#86EFAC',
  health:       '#FDBA74',
  learn:        '#C4B5FD',
  creative:     '#F9A8D4',
  mindfulness:  '#6EE7B7',
  finance:      '#FDE68A',
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
  calendarTaskTags: Record<number, number[]>;
  goals: Goal[];
  checklistItems: Record<number, GoalChecklistItem[]>;
  heatmap: DayActivity[];
  heatmapDurations: DayDuration[];
  heatmapTagStats: TagStat[];
  heatmapMonthStats: MonthStat[];
  heatmapTopTagHours: { name: string; color: string; minutes: number } | null;
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
  pendingDeleteTag: Tag | null;
  pendingDeleteChecklistItem: { item: GoalChecklistItem; goalId: number } | null;
  autostart: boolean;
  accentColor: AccentColor;
  tags: Tag[];
  taskTags: Record<number, number[]>;

  setActiveTab: (tab: Tab) => void;
  toggleTheme: () => void;
  setUiScale: (scale: number) => void;
  setLanguage: (lang: Language) => void;
  setAccentColor: (color: AccentColor) => void;
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

  loadTags: () => Promise<void>;
  loadTaskTagsForDate: (date: string) => Promise<void>;
  addTag: (name: string) => Promise<number>;
  updateTag: (id: number, name: string) => Promise<void>;
  deleteTag: (id: number) => Promise<void>;
  softDeleteTag: (id: number) => void;
  undoDeleteTag: () => void;
  confirmDeleteTag: (tag: Tag) => Promise<void>;
  setTaskTags: (taskId: number, tagIds: number[]) => Promise<void>;

  loadTasks: (date: string) => Promise<void>;
  loadCalendarTasks: (startDate: string, endDate: string) => Promise<void>;
  loadTimeEntries: (date: string) => Promise<void>;
  saveTimeEntry: (taskId: number, date: string, startTime: string, endTime: string) => Promise<void>;
  deleteTimeEntry: (taskId: number, date: string) => Promise<void>;
  addTask: (task: NewTask, timeEntry?: { startTime: string; endTime: string }, tagIds?: number[]) => Promise<void>;
  updateTask: (id: number, updates: TaskUpdate) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  softDeleteTask: (id: number) => void;
  undoDeleteTask: () => void;
  confirmDeleteTask: (task: Task) => Promise<void>;
  updateTaskColor: (category: Category, color: string) => Promise<void>;

  loadCategoryColors: () => Promise<void>;
  updateCategoryColor: (category: Category, color: string) => Promise<void>;

  loadGoals: (year: number) => Promise<void>;
  addGoal: (goal: NewGoal) => Promise<number>;
  updateGoal: (id: number, updates: GoalUpdate) => Promise<void>;
  reorderGoal: (activeId: number, newStatus: Goal['status'], newIndex: number) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  softDeleteGoal: (id: number) => void;
  undoDeleteGoal: () => void;
  confirmDeleteGoal: (goal: Goal) => Promise<void>;

  addChecklistItem: (goalId: number, text: string) => Promise<void>;
  toggleChecklistItem: (itemId: number, goalId: number) => Promise<void>;
  updateChecklistItem: (itemId: number, goalId: number, text: string) => Promise<void>;
  softDeleteChecklistItem: (itemId: number, goalId: number) => void;
  undoDeleteChecklistItem: () => void;
  confirmDeleteChecklistItem: (itemId: number, goalId: number) => Promise<void>;
  deleteChecklistItem: (itemId: number, goalId: number) => Promise<void>;

  loadHeatmap: (year: number) => Promise<void>;
  loadHeatmapDurations: (year: number) => Promise<void>;
  loadHeatmapTagStats: (startDate: string, endDate: string) => Promise<void>;
  loadHeatmapMonthStats: (year: number) => Promise<void>;
  loadHeatmapTopTagHours: (yearMonthPrefix: string) => Promise<void>;
  getStreak: () => Promise<number>;
  seedIfEmpty: () => Promise<void>;
  exportAllData: () => Promise<void>;
  importAllData: (file: File) => Promise<void>;
  resetAllData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'today',
  theme: (localStorage.getItem('theme') as Theme) ?? 'light',
  tasks: [],
  calendarTasks: [],
  taskTimeEntries: [],
  calendarTimeEntries: [],
  calendarTaskTags: {},
  goals: [],
  checklistItems: {},
  heatmap: [],
  heatmapDurations: [],
  heatmapTagStats: [],
  heatmapMonthStats: [],
  heatmapTopTagHours: null,
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
  pendingDeleteTag: null,
  pendingDeleteChecklistItem: null,
  autostart: true,
  accentColor: (localStorage.getItem('accentColor') as AccentColor) ?? 'blue',
  tags: [],
  taskTags: {},

  setActiveTab: (tab) => set({ activeTab: tab }),

  setUiScale: (scale) => {
    localStorage.setItem('uiScale', String(scale));
    set({ uiScale: scale });
  },

  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    set({ language: lang });
  },

  setAccentColor: (color) => {
    localStorage.setItem('accentColor', color);
    set({ accentColor: color });
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

  // --- Tags ---

  loadTags: async () => {
    if (!isTauri()) {
      set({ tags: dbGetTags() });
      return;
    }
    const db = await getDb();
    const tags = await db.select<Tag[]>('SELECT * FROM tags ORDER BY created_at ASC');
    set({ tags });
  },

  loadTaskTagsForDate: async (date) => {
    if (!isTauri()) {
      set({ taskTags: dbGetTaskTagsForDate(date) });
      return;
    }
    const db = await getDb();
    const rows = await db.select<{ task_id: number; tag_id: number }[]>(
      `SELECT tt.task_id, tt.tag_id FROM task_tags tt
       INNER JOIN tasks t ON t.id = tt.task_id WHERE t.date = $1`,
      [date]
    );
    const taskTags: Record<number, number[]> = {};
    for (const row of rows) {
      if (!taskTags[row.task_id]) taskTags[row.task_id] = [];
      taskTags[row.task_id].push(row.tag_id);
    }
    set({ taskTags });
  },

  addTag: async (name) => {
    const color = TAG_COLORS[get().tags.length % TAG_COLORS.length];
    if (!isTauri()) {
      const tag = dbAddTag(name, color);
      set({ tags: dbGetTags() });
      return tag.id;
    }
    const db = await getDb();
    const result = await db.execute(
      'INSERT INTO tags (name, color) VALUES ($1, $2)',
      [name, color]
    );
    await get().loadTags();
    return result.lastInsertId ?? 0;
  },

  updateTag: async (id, name) => {
    if (!isTauri()) {
      dbUpdateTag(id, name);
      set({ tags: dbGetTags() });
      return;
    }
    const db = await getDb();
    await db.execute('UPDATE tags SET name = $1 WHERE id = $2', [name, id]);
    await get().loadTags();
  },

  deleteTag: async (id) => {
    const filterTag = (map: Record<number, number[]>) => {
      const next = { ...map };
      for (const k of Object.keys(next)) next[Number(k)] = next[Number(k)].filter((tId) => tId !== id);
      return next;
    };
    if (!isTauri()) {
      dbDeleteTag(id);
      set({ tags: dbGetTags(), taskTags: filterTag(get().taskTags), calendarTaskTags: filterTag(get().calendarTaskTags) });
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM task_tags WHERE tag_id = $1', [id]);
    await db.execute('DELETE FROM tags WHERE id = $1', [id]);
    set({ taskTags: filterTag(get().taskTags), calendarTaskTags: filterTag(get().calendarTaskTags) });
    await get().loadTags();
  },

  softDeleteTag: (id) => {
    const tag = get().tags.find((t) => t.id === id);
    if (!tag) return;
    const prev = get().pendingDeleteTag;
    if (prev) get().confirmDeleteTag(prev);
    set({ tags: get().tags.filter((t) => t.id !== id), pendingDeleteTag: tag });
  },

  undoDeleteTag: () => {
    const tag = get().pendingDeleteTag;
    if (!tag) return;
    const tags = [...get().tags, tag].sort((a, b) =>
      a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0
    );
    set({ tags, pendingDeleteTag: null });
  },

  confirmDeleteTag: async (tag) => {
    const filterTag = (map: Record<number, number[]>) => {
      const next = { ...map };
      for (const k of Object.keys(next)) next[Number(k)] = next[Number(k)].filter((tId) => tId !== tag.id);
      return next;
    };
    set({ pendingDeleteTag: null, taskTags: filterTag(get().taskTags), calendarTaskTags: filterTag(get().calendarTaskTags) });
    if (!isTauri()) {
      dbDeleteTag(tag.id);
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM task_tags WHERE tag_id = $1', [tag.id]);
    await db.execute('DELETE FROM tags WHERE id = $1', [tag.id]);
  },

  setTaskTags: async (taskId, tagIds) => {
    const task = get().tasks.find((t) => t.id === taskId);
    const isSeriesTask = task && (task.repeat_daily === 1 || task.series_id != null);
    const templateId = task?.series_id ?? (task?.repeat_daily === 1 ? taskId : null);
    const fromDate = task?.date;

    if (!isTauri()) {
      dbSetTaskTags(taskId, tagIds);
      set({ taskTags: { ...get().taskTags, [taskId]: tagIds }, calendarTaskTags: { ...get().calendarTaskTags, [taskId]: tagIds } });
      return;
    }
    const db = await getDb();

    if (isSeriesTask && templateId && fromDate) {
      // Update tags on template + all instances from this date onwards
      const affected = await db.select<{ id: number }[]>(
        `SELECT id FROM tasks WHERE id = $1 OR (series_id = $1 AND date >= $2)`,
        [templateId, fromDate]
      );
      for (const { id } of affected) {
        await db.execute('DELETE FROM task_tags WHERE task_id = $1', [id]);
        for (const tagId of tagIds) {
          await db.execute('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [id, tagId]);
        }
      }
    } else {
      await db.execute('DELETE FROM task_tags WHERE task_id = $1', [taskId]);
      for (const tagId of tagIds) {
        await db.execute('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [taskId, tagId]);
      }
    }
    set({
      taskTags: { ...get().taskTags, [taskId]: tagIds },
      calendarTaskTags: { ...get().calendarTaskTags, [taskId]: tagIds },
    });
  },

  // --- Tasks ---

  loadTasks: async (date) => {
    if (!isTauri()) {
      set({ tasks: dbGetTasks(date), taskTimeEntries: dbGetTimeEntries(date), taskTags: dbGetTaskTagsForDate(date) });
      return;
    }
    const db = await getDb();

    // Lazy-create instances for active series templates that don't yet have one for this date.
    // A template is: repeat_daily=1, series_id IS NULL, date < $date, repeat_end_date IS NULL OR >= $date.
    const templatesToInstantiate = await db.select<{ id: number; title: string; category: string; created_at: string }[]>(
      `SELECT t.id, t.title, t.category, t.created_at FROM tasks t
       WHERE t.repeat_daily = 1 AND t.series_id IS NULL
         AND t.date < $1
         AND (t.repeat_end_date IS NULL OR t.repeat_end_date >= $1)
         AND NOT EXISTS (
           SELECT 1 FROM tasks inst WHERE inst.series_id = t.id AND inst.date = $1
         )`,
      [date]
    );
    for (const tpl of templatesToInstantiate) {
      const result = await db.execute(
        `INSERT INTO tasks (title, description, category, date, is_done, repeat_daily, series_id, created_at)
         VALUES ($1, NULL, $2, $3, 0, 0, $4, $5)`,
        [tpl.title, tpl.category, date, tpl.id, tpl.created_at]
      );
      const newId = result.lastInsertId;
      if (newId) {
        await db.execute(
          `INSERT INTO task_tags (task_id, tag_id) SELECT $1, tag_id FROM task_tags WHERE task_id = $2`,
          [newId, tpl.id]
        );
      }
    }

    const tasks = await db.select<Task[]>(
      `SELECT id, title, description, category, date, is_done, repeat_daily, series_id, repeat_end_date, created_at, color
       FROM tasks WHERE date = $1 ORDER BY is_done ASC, created_at ASC`,
      [date]
    );
    const taskTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date = $1',
      [date]
    );
    const tagRows = await db.select<{ task_id: number; tag_id: number }[]>(
      `SELECT tt.task_id, tt.tag_id FROM task_tags tt
       INNER JOIN tasks t ON t.id = tt.task_id WHERE t.date = $1`,
      [date]
    );
    const taskTags: Record<number, number[]> = {};
    for (const row of tagRows) {
      if (!taskTags[row.task_id]) taskTags[row.task_id] = [];
      taskTags[row.task_id].push(row.tag_id);
    }
    set({ tasks, taskTimeEntries, taskTags });
  },

  loadCalendarTasks: async (startDate, endDate) => {
    if (!isTauri()) {
      set({
        calendarTasks: dbGetCalendarTasks(startDate, endDate),
        calendarTimeEntries: dbGetCalendarTimeEntries(startDate, endDate),
        calendarTaskTags: dbGetCalendarTaskTags(startDate, endDate),
      });
      return;
    }
    const db = await getDb();
    const tasks = await db.select<Task[]>(
      'SELECT id, title, description, category, date, is_done, repeat_daily, series_id, repeat_end_date, created_at, color FROM tasks WHERE is_done = 1 AND date >= $1 AND date <= $2 ORDER BY date ASC',
      [startDate, endDate]
    );
    const calendarTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date >= $1 AND date <= $2',
      [startDate, endDate]
    );
    const tagRows = await db.select<{ task_id: number; tag_id: number }[]>(
      `SELECT tt.task_id, tt.tag_id FROM task_tags tt
       INNER JOIN tasks t ON t.id = tt.task_id
       WHERE t.is_done = 1 AND t.date >= $1 AND t.date <= $2`,
      [startDate, endDate]
    );
    const calendarTaskTags: Record<number, number[]> = {};
    for (const row of tagRows) {
      if (!calendarTaskTags[row.task_id]) calendarTaskTags[row.task_id] = [];
      calendarTaskTags[row.task_id].push(row.tag_id);
    }
    set({ calendarTasks: tasks, calendarTimeEntries, calendarTaskTags });
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
    const optimisticTaskEntries = [
      ...get().taskTimeEntries.filter((e) => !(e.task_id === taskId && e.date === date)),
      newEntry,
    ];
    const updatedCalendarEntries = [
      ...get().calendarTimeEntries.filter((e) => !(e.task_id === taskId && e.date === date)),
      newEntry,
    ];
    // Optimistic update — move task to scheduled position immediately,
    // before the async Tauri IPC + SQLite round-trip completes.
    set({ taskTimeEntries: optimisticTaskEntries, calendarTimeEntries: updatedCalendarEntries });
    if (!isTauri()) {
      dbSaveTimeEntry(taskId, date, startTime, endTime);
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

  addTask: async (task, timeEntry, tagIds) => {
    if (!isTauri()) {
      const newTask = dbAddTask({
        title: task.title, description: task.description ?? null, category: task.category,
        date: task.date, is_done: 0, repeat_daily: task.repeat_daily ?? 0,
        series_id: null, repeat_end_date: null, color: null,
      });
      if (timeEntry) dbSaveTimeEntry(newTask.id, task.date, timeEntry.startTime, timeEntry.endTime);
      if (tagIds?.length) dbSetTaskTags(newTask.id, tagIds);
      set({ tasks: dbGetTasks(get().selectedDate), taskTimeEntries: dbGetTimeEntries(get().selectedDate), taskTags: dbGetTaskTagsForDate(get().selectedDate) });
      return;
    }
    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO tasks (title, description, category, date, repeat_daily) VALUES ($1, $2, $3, $4, $5)`,
      [task.title, task.description ?? null, task.category, task.date, task.repeat_daily ?? 0]
    );
    const newTaskId = result.lastInsertId;
    if (timeEntry && newTaskId) {
      await db.execute(
        'INSERT OR REPLACE INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
        [newTaskId, task.date, timeEntry.startTime, timeEntry.endTime]
      );
    }
    if (tagIds?.length && newTaskId) {
      for (const tagId of tagIds) {
        await db.execute('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [newTaskId, tagId]);
      }
    }
    await get().loadTasks(get().selectedDate);
  },

  updateTask: async (id, updates) => {
    const task = get().tasks.find((t) => t.id === id) ?? get().calendarTasks.find((t) => t.id === id);
    if (!task) return;

    const isSeriesTask = task.repeat_daily === 1 || task.series_id != null;
    const templateId = task.series_id ?? (task.repeat_daily === 1 ? task.id : null);

    if (!isTauri()) {
      dbUpdateTask(id, updates);
      set({
        tasks: dbGetTasks(get().selectedDate),
        calendarTasks: get().calendarTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      });
      return;
    }

    const db = await getDb();

    if (!isSeriesTask || !templateId) {
      // Regular non-recurring task
      const fields = Object.keys(updates) as (keyof TaskUpdate)[];
      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map((f) => updates[f]);
      await db.execute(`UPDATE tasks SET ${setClauses} WHERE id = $1`, [id, ...values]);
      await get().loadTasks(get().selectedDate);
      set({ calendarTasks: get().calendarTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
      return;
    }

    // Series task: route fields to series (title/category) vs instance (description)
    const SERIES_FIELDS: (keyof TaskUpdate)[] = ['title', 'category'];
    const INSTANCE_FIELDS: (keyof TaskUpdate)[] = ['description', 'is_done'];

    const seriesEntries = SERIES_FIELDS.filter((f) => f in updates);
    const instanceEntries = INSTANCE_FIELDS.filter((f) => f in updates);

    if (seriesEntries.length > 0) {
      const setClauses = seriesEntries.map((f, i) => `${f} = $${i + 3}`).join(', ');
      const values = seriesEntries.map((f) => updates[f]);
      await db.execute(
        `UPDATE tasks SET ${setClauses} WHERE id = $1 OR (series_id = $1 AND date >= $2)`,
        [templateId, task.date, ...values]
      );
    }

    if (instanceEntries.length > 0) {
      const setClauses = instanceEntries.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = instanceEntries.map((f) => updates[f]);
      await db.execute(`UPDATE tasks SET ${setClauses} WHERE id = $1`, [id, ...values]);
    }

    // Handle repeat_daily toggle
    if ('repeat_daily' in updates) {
      if (updates.repeat_daily === 0 && task.repeat_daily === 1) {
        // Turning OFF: convert template to regular task and delete all instances
        await db.execute('DELETE FROM task_time_entries WHERE task_id IN (SELECT id FROM tasks WHERE series_id = $1)', [templateId]);
        await db.execute('DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE series_id = $1)', [templateId]);
        await db.execute('DELETE FROM tasks WHERE series_id = $1', [templateId]);
        await db.execute('UPDATE tasks SET repeat_daily = 0, series_id = NULL, repeat_end_date = NULL WHERE id = $1', [templateId]);
      } else if (updates.repeat_daily === 1 && task.repeat_daily === 0 && task.series_id != null) {
        // Instance: can't turn ON repeat for an instance, no-op
      } else if (updates.repeat_daily === 1 && task.repeat_daily === 0) {
        // Turning ON: this non-recurring task becomes a template
        await db.execute('UPDATE tasks SET repeat_daily = 1, series_id = NULL WHERE id = $1', [id]);
      } else if (updates.repeat_daily === 1 && task.repeat_daily === 1) {
        // Template stays ON: clear repeat_end_date in case it was capped by a prior deletion
        await db.execute('UPDATE tasks SET repeat_end_date = NULL WHERE id = $1', [templateId]);
      }
    }

    await get().loadTasks(get().selectedDate);
    set({ calendarTasks: get().calendarTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
  },

  toggleTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const newDone = task.is_done ? 0 : 1;

    if (!isTauri()) {
      dbUpdateTask(id, { is_done: newDone });
      set({ tasks: dbGetTasks(get().selectedDate) });
      return;
    }

    const db = await getDb();
    await db.execute('UPDATE tasks SET is_done = $1 WHERE id = $2', [newDone, id]);
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
    const task = get().tasks.find((t) => t.id === id) ?? get().calendarTasks.find((t) => t.id === id);
    if (!task) return;
    // If there's already a pending delete, confirm it immediately before queuing new one
    const prev = get().pendingDeleteTask;
    if (prev) {
      get().confirmDeleteTask(prev);
    }
    set({
      tasks: get().tasks.filter((t) => t.id !== id),
      calendarTasks: get().calendarTasks.filter((t) => t.id !== id),
      pendingDeleteTask: task,
    });
  },

  undoDeleteTask: () => {
    const task = get().pendingDeleteTask;
    if (!task) return;
    // Re-insert in original position (by created_at order)
    const calendarTasks = [...get().calendarTasks, task].sort((a, b) =>
      a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0
    );
    let tasks = get().tasks;
    if (task.date === get().selectedDate) {
      tasks = [...tasks, task].sort((a, b) =>
        a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0
      );
    }
    set({ tasks, calendarTasks, pendingDeleteTask: null });
  },

  confirmDeleteTask: async (task) => {
    const calendarTaskTags = { ...get().calendarTaskTags };
    delete calendarTaskTags[task.id];
    set({
      pendingDeleteTask: null,
      calendarTasks: get().calendarTasks.filter((t) => t.id !== task.id),
      calendarTaskTags,
    });
    if (!isTauri()) {
      dbDeleteTask(task.id);
      return;
    }
    const db = await getDb();
    const isSeriesTask = task.repeat_daily === 1 || task.series_id != null;

    if (isSeriesTask) {
      const templateId = task.series_id ?? task.id;
      const tplRows = await db.select<{ date: string }[]>('SELECT date FROM tasks WHERE id = $1', [templateId]);
      const templateStartDate = tplRows[0]?.date;

      if (!templateStartDate || task.date <= templateStartDate) {
        // Delete entire series
        await db.execute('DELETE FROM task_time_entries WHERE task_id = $1 OR task_id IN (SELECT id FROM tasks WHERE series_id = $1)', [templateId]);
        await db.execute('DELETE FROM task_tags WHERE task_id = $1 OR task_id IN (SELECT id FROM tasks WHERE series_id = $1)', [templateId]);
        await db.execute('DELETE FROM tasks WHERE id = $1 OR series_id = $1', [templateId]);
      } else {
        // Stop series from task.date onwards
        const yesterday = format(subDays(new Date(task.date + 'T00:00:00'), 1), 'yyyy-MM-dd');
        await db.execute('UPDATE tasks SET repeat_end_date = $1 WHERE id = $2', [yesterday, templateId]);
        await db.execute('DELETE FROM task_time_entries WHERE task_id IN (SELECT id FROM tasks WHERE (id = $1 OR series_id = $1) AND date >= $2)', [templateId, task.date]);
        await db.execute('DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE series_id = $1 AND date >= $2)', [templateId, task.date]);
        await db.execute('DELETE FROM tasks WHERE series_id = $1 AND date >= $2', [templateId, task.date]);
      }
    } else {
      await db.execute('DELETE FROM task_tags WHERE task_id = $1', [task.id]);
      await db.execute('DELETE FROM tasks WHERE id = $1', [task.id]);
    }
  },

  updateTaskColor: async (category, color) => {
    const mapper = (t: Task) => t.category === category ? { ...t, color } : t;
    const newCategoryColors = { ...get().categoryColors, [category]: color };
    set({
      tasks: get().tasks.map(mapper),
      calendarTasks: get().calendarTasks.map(mapper),
      categoryColors: newCategoryColors,
    });
    if (!isTauri()) {
      localStorage.setItem('categoryColors', JSON.stringify(newCategoryColors));
      return;
    }
    const db = await getDb();
    await db.execute('UPDATE tasks SET color = $1 WHERE category = $2', [color, category]);
    await db.execute(
      'INSERT OR REPLACE INTO category_colors (category, color) VALUES ($1, $2)',
      [category, color]
    );
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
    const priority = goal.priority ?? 'mid';
    if (!isTauri()) {
      const g = dbAddGoal({ title: goal.title, description: goal.description ?? null, category: goal.category, priority, year: goal.year, quarter: goal.quarter, status: goal.status ?? 'todo', progress: 0, position: dbGetGoals(goal.year).filter(g => g.status === (goal.status ?? 'todo')).length });
      set({ goals: dbGetGoals(get().selectedYear) });
      return g.id;
    }
    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO goals (title, description, category, priority, year, quarter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [goal.title, goal.description ?? null, goal.category, priority, goal.year, goal.quarter, goal.status ?? 'todo']
    );
    const newId = result.lastInsertId!;
    await get().loadGoals(get().selectedYear);
    return newId;
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

  updateChecklistItem: async (itemId, goalId, text) => {
    if (!isTauri()) {
      dbUpdateChecklistItem(itemId, text);
      const items = (get().checklistItems[goalId] ?? []).map((i) =>
        i.id === itemId ? { ...i, text } : i
      );
      set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
      return;
    }
    const db = await getDb();
    await db.execute('UPDATE goal_checklist_items SET text = $1 WHERE id = $2', [text, itemId]);
    const items = (get().checklistItems[goalId] ?? []).map((i) =>
      i.id === itemId ? { ...i, text } : i
    );
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
  },

  softDeleteChecklistItem: (itemId, goalId) => {
    const item = (get().checklistItems[goalId] ?? []).find((i) => i.id === itemId);
    if (!item) return;
    const prev = get().pendingDeleteChecklistItem;
    if (prev) get().confirmDeleteChecklistItem(prev.item.id, prev.goalId);
    const items = (get().checklistItems[goalId] ?? []).filter((i) => i.id !== itemId);
    set({ checklistItems: { ...get().checklistItems, [goalId]: items }, pendingDeleteChecklistItem: { item, goalId } });
  },

  undoDeleteChecklistItem: () => {
    const pending = get().pendingDeleteChecklistItem;
    if (!pending) return;
    const prev = get().checklistItems[pending.goalId] ?? [];
    const restored = [...prev, pending.item].sort((a, b) => a.position - b.position);
    set({ checklistItems: { ...get().checklistItems, [pending.goalId]: restored }, pendingDeleteChecklistItem: null });
  },

  confirmDeleteChecklistItem: async (itemId, _goalId) => {
    set({ pendingDeleteChecklistItem: null });
    if (!isTauri()) { dbDeleteChecklistItem(itemId); return; }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE id = $1', [itemId]);
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

  loadHeatmapDurations: async (year) => {
    if (!isTauri()) { set({ heatmapDurations: [] }); return; }
    const db = await getDb();
    const rows = await db.select<DayDuration[]>(
      `SELECT date,
         COALESCE(SUM(
           (CAST(SUBSTR(end_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(end_time, 4, 2) AS INTEGER)) -
           (CAST(SUBSTR(start_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(start_time, 4, 2) AS INTEGER))
         ), 0) as minutes
       FROM task_time_entries
       WHERE date LIKE $1 AND end_time > start_time
       GROUP BY date`,
      [`${year}-%`]
    );
    set({ heatmapDurations: rows });
  },

  loadHeatmapTagStats: async (startDate, endDate) => {
    if (!isTauri()) { set({ heatmapTagStats: [] }); return; }
    const db = await getDb();
    const rows = await db.select<TagStat[]>(
      `SELECT tg.name, tg.color,
         COUNT(DISTINCT t.id) as tasks,
         COALESCE(SUM(
           CASE WHEN tte.end_time > tte.start_time THEN
             (CAST(SUBSTR(tte.end_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.end_time, 4, 2) AS INTEGER)) -
             (CAST(SUBSTR(tte.start_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.start_time, 4, 2) AS INTEGER))
           ELSE 0 END
         ), 0) as minutes
       FROM tags tg
       JOIN task_tags tt ON tt.tag_id = tg.id
       JOIN tasks t ON t.id = tt.task_id
       LEFT JOIN task_time_entries tte ON tte.task_id = t.id
       WHERE t.date >= $1 AND t.date <= $2 AND t.is_done = 1
       GROUP BY tg.id
       ORDER BY tasks DESC, minutes DESC
       LIMIT 6`,
      [startDate, endDate]
    );
    set({ heatmapTagStats: rows });
  },

  loadHeatmapMonthStats: async (year) => {
    if (!isTauri()) { set({ heatmapMonthStats: [] }); return; }
    const db = await getDb();
    const rows = await db.select<MonthStat[]>(
      `SELECT
         CAST(SUBSTR(date, 6, 2) AS INTEGER) as month,
         COUNT(*) as created,
         SUM(is_done) as done
       FROM tasks
       WHERE date LIKE $1
       GROUP BY month
       ORDER BY month`,
      [`${year}-%`]
    );
    set({ heatmapMonthStats: rows });
  },

  loadHeatmapTopTagHours: async (yearMonthPrefix) => {
    if (!isTauri()) { set({ heatmapTopTagHours: null }); return; }
    const db = await getDb();
    const rows = await db.select<{ name: string; color: string; minutes: number }[]>(
      `SELECT tg.name, tg.color,
         COALESCE(SUM(
           CASE WHEN tte.end_time > tte.start_time THEN
             (CAST(SUBSTR(tte.end_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.end_time, 4, 2) AS INTEGER)) -
             (CAST(SUBSTR(tte.start_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.start_time, 4, 2) AS INTEGER))
           ELSE 0 END
         ), 0) as minutes
       FROM tags tg
       JOIN task_tags tt ON tt.tag_id = tg.id
       JOIN tasks t ON t.id = tt.task_id
       LEFT JOIN task_time_entries tte ON tte.task_id = t.id AND tte.date LIKE $1
       WHERE tte.end_time > tte.start_time
       GROUP BY tg.id
       ORDER BY minutes DESC
       LIMIT 1`,
      [`${yearMonthPrefix}%`]
    );
    set({ heatmapTopTagHours: rows.length > 0 && rows[0].minutes > 0 ? rows[0] : null });
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
    let tags: Tag[];
    let taskTagPairs: Array<{ task_id: number; tag_id: number }>;
    let timeEntries: TaskTimeEntry[];

    if (!isTauri()) {
      tasks = [...mockTasks];
      goals = [...mockGoals];
      checklistItems = dbGetAllChecklistItems();
      const stored = localStorage.getItem('categoryColors');
      categoryColors = stored ? JSON.parse(stored) : { ...DEFAULT_CATEGORY_COLORS };
      tags = [...mockTags];
      taskTagPairs = Object.entries(mockTaskTags).flatMap(([taskId, tagIds]) =>
        tagIds.map((tagId) => ({ task_id: Number(taskId), tag_id: tagId }))
      );
      timeEntries = [...mockTimeEntries];
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
      tags = await db.select<Tag[]>('SELECT * FROM tags ORDER BY created_at ASC');
      taskTagPairs = await db.select<Array<{ task_id: number; tag_id: number }>>('SELECT task_id, tag_id FROM task_tags');
      timeEntries = await db.select<TaskTimeEntry[]>('SELECT * FROM task_time_entries ORDER BY task_id, date');
    }

    const payload = { version: '1.2', exportedAt: new Date().toISOString(), tasks, goals, checklistItems, categoryColors, tags, taskTags: taskTagPairs, timeEntries };
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
    let data: { tasks?: Task[]; goals?: Goal[]; checklistItems?: GoalChecklistItem[]; categoryColors?: CategoryColors; tags?: Tag[]; taskTags?: Array<{ task_id: number; tag_id: number }>; timeEntries?: TaskTimeEntry[] };
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
      mockTags.length = 0;
      if (Array.isArray(data.tags)) mockTags.push(...data.tags);
      for (const k of Object.keys(mockTaskTags)) delete mockTaskTags[Number(k)];
      if (Array.isArray(data.taskTags)) {
        for (const tt of data.taskTags) {
          if (!mockTaskTags[tt.task_id]) mockTaskTags[tt.task_id] = [];
          mockTaskTags[tt.task_id].push(tt.tag_id);
        }
      }
      mockTimeEntries.length = 0;
      if (Array.isArray(data.timeEntries)) mockTimeEntries.push(...data.timeEntries);
    } else {
      const db = await getDb();
      await db.execute('DELETE FROM task_time_entries');
      await db.execute('DELETE FROM task_tags');
      await db.execute('DELETE FROM goal_checklist_items');
      await db.execute('DELETE FROM tasks');
      await db.execute('DELETE FROM goals');
      await db.execute('DELETE FROM category_colors');
      await db.execute('DELETE FROM tags');

      for (const t of data.tasks) {
        await db.execute(
          `INSERT INTO tasks (id, title, description, category, date, is_done, repeat_daily, series_id, repeat_end_date, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [t.id, t.title, t.description ?? null, t.category, t.date, t.is_done, t.repeat_daily ?? 0,
           t.series_id ?? null, t.repeat_end_date ?? null, t.created_at]
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
      if (Array.isArray(data.tags)) {
        for (const tag of data.tags) {
          await db.execute(
            'INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)',
            [tag.id, tag.name, tag.color, tag.created_at]
          );
        }
      }
      if (Array.isArray(data.taskTags)) {
        for (const tt of data.taskTags) {
          await db.execute('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [tt.task_id, tt.tag_id]);
        }
      }
      if (Array.isArray(data.timeEntries)) {
        for (const te of data.timeEntries) {
          await db.execute(
            'INSERT OR IGNORE INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
            [te.task_id, te.date, te.start_time, te.end_time]
          );
        }
      }
    }

    const year = new Date().getFullYear();
    await get().loadTasks(get().selectedDate);
    await get().loadGoals(get().selectedYear);
    await get().loadHeatmap(get().selectedYear);
    await get().loadCategoryColors();
    await get().loadTags();
    await get().loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
  },

  resetAllData: async () => {
    if (!isTauri()) {
      mockTasks.length = 0;
      mockGoals.length = 0;
      mockChecklist.length = 0;
      mockTags.length = 0;
      for (const k of Object.keys(mockTaskTags)) delete mockTaskTags[Number(k)];
      localStorage.removeItem('categoryColors');
    } else {
      const db = await getDb();
      await db.execute('DELETE FROM task_time_entries');
      await db.execute('DELETE FROM task_tags');
      await db.execute('DELETE FROM goal_checklist_items');
      await db.execute('DELETE FROM tasks');
      await db.execute('DELETE FROM goals');
      await db.execute('DELETE FROM category_colors');
      await db.execute('DELETE FROM tags');
    }
    const year = new Date().getFullYear();
    await get().loadTasks(get().selectedDate);
    await get().loadGoals(get().selectedYear);
    await get().loadHeatmap(get().selectedYear);
    await get().loadCategoryColors();
    await get().loadTags();
    await get().loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
  },
}));
