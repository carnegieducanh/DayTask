import type { StateCreator } from 'zustand';
import { format, subDays } from 'date-fns';
import type { Task, NewTask, TaskUpdate, TaskTimeEntry, Category, CategoryColors } from '../../types';
import {
  isTauri,
  dbGetTasks, dbAddTask, dbUpdateTask, dbDeleteTask, dbReorderDeckTasks,
  dbGetCalendarTasks,
  dbGetTimeEntries, dbGetCalendarTimeEntries, dbSaveTimeEntry, dbDeleteTimeEntry,
  dbGetTaskTagsForDate, dbSetTaskTags, dbGetCalendarTaskTags,
} from '../mockDb';
import { getDb } from '../db';
import type { AppState } from '../appStore';

export const DEFAULT_CATEGORY_COLORS: CategoryColors = {
  work:         '#7DD3FC',
  personal:     '#86EFAC',
  health:       '#FDBA74',
  learn:        '#C4B5FD',
  creative:     '#F9A8D4',
  mindfulness:  '#6EE7B7',
  finance:      '#FDE68A',
  other:        '#9E9E9E',
};

export interface TaskSlice {
  tasks: Task[];
  calendarTasks: Task[];
  taskTimeEntries: TaskTimeEntry[];
  calendarTimeEntries: TaskTimeEntry[];
  calendarTaskTags: Record<number, number[]>;
  categoryColors: CategoryColors;
  pendingDeleteTask: Task | null;

  loadTasks: (date: string) => Promise<{ tasks: Task[]; taskTimeEntries: TaskTimeEntry[] }>;
  loadCalendarTasks: (startDate: string, endDate: string) => Promise<void>;
  loadTimeEntries: (date: string) => Promise<void>;
  saveTimeEntry: (taskId: number, date: string, startTime: string, endTime: string) => Promise<void>;
  deleteTimeEntry: (taskId: number, date: string) => Promise<void>;
  addTask: (task: NewTask, timeEntry?: { startTime: string; endTime: string }, tagIds?: number[]) => Promise<void>;
  duplicateTask: (sourceId: number, date: string, timeEntry?: { startTime: string; endTime: string }) => Promise<void>;
  updateTask: (id: number, updates: TaskUpdate) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  softDeleteTask: (id: number) => void;
  undoDeleteTask: () => void;
  confirmDeleteTask: (task: Task) => Promise<void>;
  updateTaskColor: (category: Category, color: string) => Promise<void>;
  reorderDeckTasks: (orderedTaskIds: number[]) => Promise<void>;

  loadCategoryColors: () => Promise<void>;
  updateCategoryColor: (category: Category, color: string) => Promise<void>;
}

export const createTaskSlice: StateCreator<AppState, [], [], TaskSlice> = (set, get) => ({
  tasks: [],
  calendarTasks: [],
  taskTimeEntries: [],
  calendarTimeEntries: [],
  calendarTaskTags: {},
  categoryColors: { ...DEFAULT_CATEGORY_COLORS },
  pendingDeleteTask: null,

  loadTasks: async (date) => {
    if (!isTauri()) {
      const tasks = dbGetTasks(date);
      const taskTimeEntries = dbGetTimeEntries(date);
      const taskTags = dbGetTaskTagsForDate(date);
      if (date === get().selectedDate) set({ tasks, taskTimeEntries, taskTags });
      return { tasks, taskTimeEntries };
    }
    const db = await getDb();

    // Only instantiate daily templates in the main window to prevent race conditions
    // when multiple webview windows (main + tray-popup) call loadTasks concurrently.
    const windowLabel = (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } }).__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
    const isMainWindow = !windowLabel || windowLabel === 'main';

    if (isMainWindow) {
      // Lazy-create instances for active series templates that don't yet have one for this date.
      // A template is: repeat_daily=1, series_id IS NULL, date < $date, repeat_end_date IS NULL OR >= $date.
      // deck_position is carried over from the template so a manually-reordered deck
      // (see reorderDeckTasks) stays in the same order on days not visited yet.
      const templatesToInstantiate = await db.select<{ id: number; title: string; category: string; created_at: string; deck_position: number | null }[]>(
        `SELECT t.id, t.title, t.category, t.created_at, t.deck_position FROM tasks t
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
          `INSERT OR IGNORE INTO tasks (title, description, category, date, is_done, repeat_daily, series_id, created_at, deck_position)
           VALUES ($1, NULL, $2, $3, 0, 0, $4, $5, $6)`,
          [tpl.title, tpl.category, date, tpl.id, tpl.created_at, tpl.deck_position]
        );
        const newId = result.lastInsertId;
        if (newId) {
          await db.execute(
            `INSERT INTO task_tags (task_id, tag_id) SELECT $1, tag_id FROM task_tags WHERE task_id = $2`,
            [newId, tpl.id]
          );
        }
      }
    }

    const tasks = await db.select<Task[]>(
      `SELECT id, title, description, category, date, is_done, repeat_daily, series_id, repeat_end_date, created_at, color, deck_position
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
    if (date === get().selectedDate) set({ tasks, taskTimeEntries, taskTags });
    return { tasks, taskTimeEntries };
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
      'SELECT id, title, description, category, date, is_done, repeat_daily, series_id, repeat_end_date, created_at, color, deck_position FROM tasks WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
      [startDate, endDate]
    );
    const calendarTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date >= $1 AND date <= $2',
      [startDate, endDate]
    );
    const tagRows = await db.select<{ task_id: number; tag_id: number }[]>(
      `SELECT tt.task_id, tt.tag_id FROM task_tags tt
       INNER JOIN tasks t ON t.id = tt.task_id
       WHERE t.date >= $1 AND t.date <= $2`,
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
    // A task with no time entry has nothing to show "done" against (Today/Day both
    // require an entry to display it at all) — clear is_done so it doesn't become
    // a ghost that only resurfaces, undated, in Week/Month view.
    const wasDone =
      get().tasks.find((t) => t.id === taskId)?.is_done === 1 ||
      get().calendarTasks.find((t) => t.id === taskId)?.is_done === 1;
    const clearDone = (list: Task[]) =>
      wasDone ? list.map((t) => (t.id === taskId ? { ...t, is_done: 0 } : t)) : list;

    if (!isTauri()) {
      dbDeleteTimeEntry(taskId, date);
      if (wasDone) dbUpdateTask(taskId, { is_done: 0 });
      set({
        taskTimeEntries: dbGetTimeEntries(date),
        calendarTimeEntries: updatedCalendarEntries,
        tasks: clearDone(get().tasks),
        calendarTasks: clearDone(get().calendarTasks),
      });
      return;
    }
    const db = await getDb();
    await db.execute(
      'DELETE FROM task_time_entries WHERE task_id = $1 AND date = $2',
      [taskId, date]
    );
    if (wasDone) {
      await db.execute('UPDATE tasks SET is_done = 0 WHERE id = $1', [taskId]);
    }
    const taskTimeEntries = await db.select<TaskTimeEntry[]>(
      'SELECT * FROM task_time_entries WHERE date = $1',
      [date]
    );
    set({
      taskTimeEntries,
      calendarTimeEntries: updatedCalendarEntries,
      tasks: clearDone(get().tasks),
      calendarTasks: clearDone(get().calendarTasks),
    });
  },

  addTask: async (task, timeEntry, tagIds) => {
    if (!isTauri()) {
      const newTask = dbAddTask({
        title: task.title, description: task.description ?? null, category: task.category,
        date: task.date, is_done: 0, repeat_daily: task.repeat_daily ?? 0,
        series_id: null, repeat_end_date: null, color: null, deck_position: null,
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

  duplicateTask: async (sourceId, date, timeEntry) => {
    const source = get().tasks.find((t) => t.id === sourceId) ?? get().calendarTasks.find((t) => t.id === sourceId);
    if (!source) return;
    const sourceTagIds = get().taskTags[sourceId] ?? [];

    if (!isTauri()) {
      const newTask = dbAddTask({
        title: source.title, description: source.description, category: source.category,
        date, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, color: source.color,
        deck_position: null,
      });
      if (timeEntry) dbSaveTimeEntry(newTask.id, date, timeEntry.startTime, timeEntry.endTime);
      if (sourceTagIds.length) dbSetTaskTags(newTask.id, sourceTagIds);
      set({
        tasks: dbGetTasks(get().selectedDate),
        taskTimeEntries: dbGetTimeEntries(get().selectedDate),
        taskTags: dbGetTaskTagsForDate(get().selectedDate),
      });
      return;
    }

    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO tasks (title, description, category, date, repeat_daily, color) VALUES ($1, $2, $3, $4, 0, $5)`,
      [source.title, source.description, source.category, date, source.color]
    );
    const newTaskId = result.lastInsertId;
    if (!newTaskId) return;
    if (timeEntry) {
      await db.execute(
        'INSERT OR REPLACE INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
        [newTaskId, date, timeEntry.startTime, timeEntry.endTime]
      );
    }
    for (const tagId of sourceTagIds) {
      await db.execute('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [newTaskId, tagId]);
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
      tasks: get().tasks.filter((t) => t.id !== task.id),
      calendarTasks: get().calendarTasks.filter((t) => t.id !== task.id),
      taskTimeEntries: get().taskTimeEntries.filter((e) => e.task_id !== task.id),
      calendarTimeEntries: get().calendarTimeEntries.filter((e) => e.task_id !== task.id),
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
      await db.execute('DELETE FROM task_time_entries WHERE task_id = $1', [task.id]);
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

  reorderDeckTasks: async (orderedTaskIds) => {
    const date = get().selectedDate;
    const taskLookup = get().tasks;
    const positions = new Map(orderedTaskIds.map((id, i) => [id, i]));
    const mapper = (t: Task) => (positions.has(t.id) ? { ...t, deck_position: positions.get(t.id)! } : t);
    set({ tasks: get().tasks.map(mapper), calendarTasks: get().calendarTasks.map(mapper) });
    if (!isTauri()) {
      dbReorderDeckTasks(orderedTaskIds, date);
      return;
    }
    const db = await getDb();
    for (let i = 0; i < orderedTaskIds.length; i++) {
      const taskId = orderedTaskIds[i];
      await db.execute('UPDATE tasks SET deck_position = $1 WHERE id = $2', [i, taskId]);

      // Recurring task: carry this order onto the template + future instances too,
      // so the deck stays arranged the same way on days the user hasn't reordered yet.
      const task = taskLookup.find((t) => t.id === taskId);
      const templateId = task?.series_id ?? (task?.repeat_daily === 1 ? task.id : null);
      if (templateId) {
        await db.execute(
          'UPDATE tasks SET deck_position = $1 WHERE id = $2 OR (series_id = $2 AND date >= $3)',
          [i, templateId, date]
        );
      }
    }
  },

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
});
