import type { StateCreator } from 'zustand';
import { addDays, format, subDays } from 'date-fns';
import type { Task, NewTask, TaskUpdate, TaskTimeEntry, Category, CategoryColors } from '../../types';
import {
  isTauri,
  dbGetTasks, dbAddTask, dbUpdateTask, dbDeleteTask, dbReorderDeckTasks,
  dbGetCalendarTasks, dbMaterializeRepeats,
  dbGetTimeEntries, dbGetCalendarTimeEntries, dbSaveTimeEntry, dbDeleteTimeEntry,
  dbGetTaskTagsForDate, dbSetTaskTags, dbGetCalendarTaskTags,
} from '../mockDb';
import { getDb } from '../db';
import type { AppState } from '../appStore';
import { repeatSlotOn } from '../../utils/repeatSchedule';

type Db = Awaited<ReturnType<typeof getDb>>;

// Cột dùng cho mọi SELECT task. Instance không có repeat_days riêng (cột chỉ ghi trên
// template) → lấy lịch của template, để modal sửa task mở từ instance vẫn thấy đúng lịch.
const TASK_COLUMNS = `t.id, t.title, t.description, t.category, t.date, t.is_done, t.repeat_daily,
  t.series_id, t.repeat_end_date, t.created_at, t.color, t.deck_position,
  COALESCE(t.repeat_days, (SELECT tpl.repeat_days FROM tasks tpl WHERE tpl.id = t.series_id)) AS repeat_days`;

export interface CreatedInstance {
  task: Task;
  entry: TaskTimeEntry | null;
  tagIds: number[];
}

// Chỉ cửa sổ chính được tạo instance — tránh race khi main + tray-popup cùng nạp task.
function isMainWindow(): boolean {
  const label = (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } })
    .__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
  return !label || label === 'main';
}

/**
 * Tạo instance còn thiếu của các chuỗi lặp cho mọi ngày trong [start, end], theo lịch
 * của từng template: chỉ vào đúng thứ đã chọn; thứ nào có giờ thì ghi luôn time entry
 * (task lên thẳng dòng thời gian), không giờ thì nằm ở khay "Chờ xếp lịch" như trước.
 * scheduledOnly: chỉ xét chuỗi có lịch theo thứ — chuỗi "hằng ngày" cũ vẫn chỉ được
 * tạo khi mở đúng ngày đó (loadTasks), không tạo trước.
 */
async function materializeRepeats(db: Db, start: string, end: string, scheduledOnly: boolean): Promise<CreatedInstance[]> {
  const templates = await db.select<{
    id: number; title: string; category: Category; date: string; created_at: string;
    deck_position: number | null; repeat_end_date: string | null; repeat_days: string | null;
  }[]>(
    `SELECT id, title, category, date, created_at, deck_position, repeat_end_date, repeat_days FROM tasks
     WHERE repeat_daily = 1 AND series_id IS NULL AND date < $2
       AND (repeat_end_date IS NULL OR repeat_end_date >= $1)
       ${scheduledOnly ? 'AND repeat_days IS NOT NULL' : ''}`,
    [start, end]
  );
  if (!templates.length) return [];
  const existingRows = await db.select<{ series_id: number; date: string }[]>(
    'SELECT series_id, date FROM tasks WHERE series_id IS NOT NULL AND date >= $1 AND date <= $2',
    [start, end]
  );
  const existing = new Set(existingRows.map((r) => `${r.series_id}|${r.date}`));
  const tplTagCache = new Map<number, number[]>();
  const created: CreatedInstance[] = [];

  for (let d = new Date(start + 'T00:00:00'); ; d = addDays(d, 1)) {
    const date = format(d, 'yyyy-MM-dd');
    if (date > end) break;
    for (const tpl of templates) {
      if (tpl.date >= date) continue;
      if (tpl.repeat_end_date && tpl.repeat_end_date < date) continue;
      if (existing.has(`${tpl.id}|${date}`)) continue;
      const slot = repeatSlotOn(tpl.repeat_days, date);
      if (!slot) continue;

      // deck_position lấy theo template để khay giữ thứ tự đã sắp (xem reorderDeckTasks).
      const result = await db.execute(
        `INSERT OR IGNORE INTO tasks (title, description, category, date, is_done, repeat_daily, series_id, created_at, deck_position)
         VALUES ($1, NULL, $2, $3, 0, 0, $4, $5, $6)`,
        [tpl.title, tpl.category, date, tpl.id, tpl.created_at, tpl.deck_position]
      );
      // Bị IGNORE (luồng khác vừa tạo cùng ngày) thì lastInsertId là id cũ — không được dùng.
      if (!result.rowsAffected || !result.lastInsertId) continue;
      const newId = result.lastInsertId;

      await db.execute(
        `INSERT INTO task_tags (task_id, tag_id) SELECT $1, tag_id FROM task_tags WHERE task_id = $2`,
        [newId, tpl.id]
      );
      if (!tplTagCache.has(tpl.id)) {
        const rows = await db.select<{ tag_id: number }[]>('SELECT tag_id FROM task_tags WHERE task_id = $1', [tpl.id]);
        tplTagCache.set(tpl.id, rows.map((r) => r.tag_id));
      }

      let entry: TaskTimeEntry | null = null;
      if (slot.start && slot.end) {
        await db.execute(
          'INSERT OR REPLACE INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
          [newId, date, slot.start, slot.end]
        );
        entry = { task_id: newId, date, start_time: slot.start, end_time: slot.end };
      }

      created.push({
        task: {
          id: newId, title: tpl.title, description: null, category: tpl.category, date,
          is_done: 0, repeat_daily: 0, series_id: tpl.id, repeat_end_date: null,
          created_at: tpl.created_at, color: null, deck_position: tpl.deck_position,
          repeat_days: tpl.repeat_days,
        },
        entry,
        tagIds: tplTagCache.get(tpl.id) ?? [],
      });
    }
  }
  return created;
}

// Instance vừa tạo phải vào luôn cặp state calendar* (Day sidebar stats, dải tuần Today
// đọc từ đó) — xem bài học calendar_stats_sync_bug.
function mergeIntoCalendar(get: () => AppState, set: (partial: Partial<AppState>) => void, created: CreatedInstance[]) {
  if (!created.length) return;
  const ids = new Set(created.map((c) => c.task.id));
  const calendarTaskTags = { ...get().calendarTaskTags };
  for (const c of created) if (c.tagIds.length) calendarTaskTags[c.task.id] = [...c.tagIds];
  set({
    calendarTasks: [...get().calendarTasks.filter((t) => !ids.has(t.id)), ...created.map((c) => c.task)],
    calendarTimeEntries: [
      ...get().calendarTimeEntries.filter((e) => !ids.has(e.task_id)),
      ...created.flatMap((c) => (c.entry ? [c.entry] : [])),
    ],
    calendarTaskTags,
  });
}

// Gỡ các task đã bị xoá khỏi DB ra khỏi mọi state đang giữ chúng.
function dropFromState(get: () => AppState, set: (partial: Partial<AppState>) => void, ids: Set<number>) {
  if (!ids.size) return;
  const calendarTaskTags = { ...get().calendarTaskTags };
  const taskTags = { ...get().taskTags };
  for (const id of ids) {
    delete calendarTaskTags[id];
    delete taskTags[id];
  }
  set({
    tasks: get().tasks.filter((t) => !ids.has(t.id)),
    calendarTasks: get().calendarTasks.filter((t) => !ids.has(t.id)),
    taskTimeEntries: get().taskTimeEntries.filter((e) => !ids.has(e.task_id)),
    calendarTimeEntries: get().calendarTimeEntries.filter((e) => !ids.has(e.task_id)),
    calendarTaskTags,
    taskTags,
  });
}

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
  // Tăng mỗi khi lịch lặp của 1 chuỗi đổi → nơi tạo trước instance (dải tuần Today) chạy lại.
  repeatScheduleVersion: number;

  loadTasks: (date: string) => Promise<{ tasks: Task[]; taskTimeEntries: TaskTimeEntry[] }>;
  loadCalendarTasks: (startDate: string, endDate: string) => Promise<void>;
  ensureRepeatInstances: (startDate: string, endDate: string) => Promise<void>;
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
  repeatScheduleVersion: 0,

  loadTasks: async (date) => {
    if (!isTauri()) {
      mergeIntoCalendar(get, set, dbMaterializeRepeats(date, date, false));
      const tasks = dbGetTasks(date);
      const taskTimeEntries = dbGetTimeEntries(date);
      const taskTags = dbGetTaskTagsForDate(date);
      if (date === get().selectedDate) set({ tasks, taskTimeEntries, taskTags });
      return { tasks, taskTimeEntries };
    }
    const db = await getDb();

    // Lazy-create instance của mọi chuỗi lặp (cả "hằng ngày" cũ lẫn lịch theo thứ) cho
    // ngày này. Chỉ ở cửa sổ chính để main + tray-popup không cùng tạo.
    if (isMainWindow()) {
      mergeIntoCalendar(get, set, await materializeRepeats(db, date, date, false));
    }

    const tasks = await db.select<Task[]>(
      `SELECT ${TASK_COLUMNS} FROM tasks t WHERE t.date = $1 ORDER BY t.is_done ASC, t.created_at ASC`,
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
      `SELECT ${TASK_COLUMNS} FROM tasks t WHERE t.date >= $1 AND t.date <= $2 ORDER BY t.date ASC`,
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

  // Tạo trước instance của chuỗi có lịch theo thứ trong khoảng đang hiển thị (dải tuần
  // Today), để lịch tuần thấy ngay các buổi sắp tới. Chỉ từ hôm nay trở đi — ngày đã
  // qua vẫn chỉ tạo khi mở đúng ngày đó, không đẻ task chưa xong vào quá khứ.
  ensureRepeatInstances: async (startDate, endDate) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const from = startDate > today ? startDate : today;
    if (from > endDate) return;

    let created: CreatedInstance[];
    if (!isTauri()) {
      created = dbMaterializeRepeats(from, endDate, true);
    } else {
      if (!isMainWindow()) return;
      created = await materializeRepeats(await getDb(), from, endDate, true);
    }
    mergeIntoCalendar(get, set, created);
    const sel = get().selectedDate;
    if (created.some((c) => c.task.date === sel)) await get().loadTasks(sel);
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
    // Snapshot entry trước khi ghi đè, để Ctrl+Z biết phục hồi lại giờ cũ
    // (hoặc gỡ hẳn nếu task này trước đó chưa có lịch — tức đang ở deck).
    const prevEntry = get().calendarTimeEntries.find((e) => e.task_id === taskId) ?? null;
    const task = get().tasks.find((t) => t.id === taskId) ?? get().calendarTasks.find((t) => t.id === taskId);

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
    } else {
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
    }

    get().pushHistory({
      label: task?.title ?? '',
      undo: async () => {
        if (prevEntry) {
          await get().saveTimeEntry(taskId, prevEntry.date, prevEntry.start_time, prevEntry.end_time);
        } else {
          await get().deleteTimeEntry(taskId, date);
        }
      },
    });
  },

  deleteTimeEntry: async (taskId, date) => {
    const prevEntry = get().calendarTimeEntries.find((e) => e.task_id === taskId && e.date === date) ?? null;
    const task = get().tasks.find((t) => t.id === taskId) ?? get().calendarTasks.find((t) => t.id === taskId);
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
    } else {
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
    }

    get().pushHistory({
      label: task?.title ?? '',
      undo: async () => {
        if (prevEntry) {
          await get().saveTimeEntry(taskId, prevEntry.date, prevEntry.start_time, prevEntry.end_time);
        }
        if (wasDone) {
          await get().updateTask(taskId, { is_done: 1 });
        }
      },
    });
  },

  addTask: async (task, timeEntry, tagIds) => {
    const repeatDays = task.repeat_daily ? (task.repeat_days ?? null) : null;
    if (task.repeat_daily) set({ repeatScheduleVersion: get().repeatScheduleVersion + 1 });
    if (!isTauri()) {
      const newTask = dbAddTask({
        title: task.title, description: task.description ?? null, category: task.category,
        date: task.date, is_done: 0, repeat_daily: task.repeat_daily ?? 0,
        series_id: null, repeat_end_date: null, color: null, deck_position: null,
        repeat_days: repeatDays,
      });
      if (timeEntry) dbSaveTimeEntry(newTask.id, task.date, timeEntry.startTime, timeEntry.endTime);
      if (tagIds?.length) dbSetTaskTags(newTask.id, tagIds);
      set({ tasks: dbGetTasks(get().selectedDate), taskTimeEntries: dbGetTimeEntries(get().selectedDate), taskTags: dbGetTaskTagsForDate(get().selectedDate) });
      if (tagIds?.length) await get().loadTagCategories();
      return;
    }
    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO tasks (title, description, category, date, repeat_daily, repeat_days) VALUES ($1, $2, $3, $4, $5, $6)`,
      [task.title, task.description ?? null, task.category, task.date, task.repeat_daily ?? 0, repeatDays]
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
    // Tag mới tạo trong modal chỉ có category (→ màu) sau khi gắn vào task đầu tiên
    if (tagIds?.length) await get().loadTagCategories();
  },

  duplicateTask: async (sourceId, date, timeEntry) => {
    const source = get().tasks.find((t) => t.id === sourceId) ?? get().calendarTasks.find((t) => t.id === sourceId);
    if (!source) return;
    const sourceTagIds = get().taskTags[sourceId] ?? [];

    if (!isTauri()) {
      const newTask = dbAddTask({
        title: source.title, description: source.description, category: source.category,
        date, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, color: source.color, repeat_days: null,
        deck_position: null,
      });
      if (timeEntry) dbSaveTimeEntry(newTask.id, date, timeEntry.startTime, timeEntry.endTime);
      if (sourceTagIds.length) dbSetTaskTags(newTask.id, sourceTagIds);
      set({
        tasks: dbGetTasks(get().selectedDate),
        taskTimeEntries: dbGetTimeEntries(get().selectedDate),
        taskTags: dbGetTaskTagsForDate(get().selectedDate),
        calendarTasks: [...get().calendarTasks, newTask],
        calendarTimeEntries: timeEntry
          ? [...get().calendarTimeEntries, { task_id: newTask.id, date, start_time: timeEntry.startTime, end_time: timeEntry.endTime }]
          : get().calendarTimeEntries,
      });
      get().pushHistory({
        label: source.title,
        undo: () => get().confirmDeleteTask(newTask),
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
    const newCalendarTask: Task = {
      id: newTaskId, title: source.title, description: source.description, category: source.category,
      date, is_done: 0, repeat_daily: 0, series_id: null, repeat_end_date: null, color: source.color, repeat_days: null,
      deck_position: null, created_at: '',
    };
    set({
      calendarTasks: [...get().calendarTasks, newCalendarTask],
      calendarTimeEntries: timeEntry
        ? [...get().calendarTimeEntries, { task_id: newTaskId, date, start_time: timeEntry.startTime, end_time: timeEntry.endTime }]
        : get().calendarTimeEntries,
    });
    get().pushHistory({
      label: source.title,
      undo: () => get().confirmDeleteTask(newCalendarTask),
    });
  },

  updateTask: async (id, updates) => {
    const task = get().tasks.find((t) => t.id === id) ?? get().calendarTasks.find((t) => t.id === id);
    if (!task) return;

    // Snapshot giá trị cũ của đúng những field sắp bị ghi đè, để Ctrl+Z có thể
    // gọi lại updateTask(id, prevUpdates) và đi qua cùng logic series-routing này.
    // Lưu ý: nếu updates.repeat_daily tắt lặp lại, các instance tương lai bị xoá
    // hẳn khỏi DB — hoàn tác sẽ bật lại repeat_daily nhưng KHÔNG khôi phục được
    // những instance đã xoá đó (giới hạn đã biết, chấp nhận được).
    const prevUpdates = {} as TaskUpdate;
    for (const key of Object.keys(updates) as (keyof TaskUpdate)[]) {
      (prevUpdates as Record<string, unknown>)[key] = task[key];
    }
    get().pushHistory({
      label: task.title,
      undo: () => get().updateTask(id, prevUpdates),
    });

    const isSeriesTask = task.repeat_daily === 1 || task.series_id != null;
    const templateId = task.series_id ?? (task.repeat_daily === 1 ? task.id : null);
    const turningOff = updates.repeat_daily === 0 && task.repeat_daily === 1;
    const turningOn = updates.repeat_daily === 1 && task.repeat_daily === 0 && task.series_id == null;
    // Lịch theo thứ/giờ là của cả chuỗi (ghi lên template). Tắt lặp thì nhánh tắt tự xoá lịch.
    const nextSchedule = updates.repeat_days ?? null;
    const scheduleChanged = 'repeat_days' in updates && !turningOff && nextSchedule !== (task.repeat_days ?? null);

    // Task đang sửa nhận updates; đổi lịch thì mọi thành viên chuỗi trong state nhận lịch mới.
    const syncCalendarFields = () =>
      set({
        calendarTasks: get().calendarTasks.map((t) => {
          const next = t.id === id ? { ...t, ...updates } : t;
          return scheduleChanged && templateId != null && (t.id === templateId || t.series_id === templateId)
            ? { ...next, repeat_days: nextSchedule }
            : next;
        }),
      });
    const bumpScheduleVersion = () => {
      if (scheduleChanged || turningOn) set({ repeatScheduleVersion: get().repeatScheduleVersion + 1 });
    };

    if (!isTauri()) {
      dropFromState(get, set, new Set(dbUpdateTask(id, updates)));
      await get().loadTasks(get().selectedDate);
      syncCalendarFields();
      bumpScheduleVersion();
      return;
    }

    const db = await getDb();

    if (!isSeriesTask || !templateId) {
      // Regular non-recurring task (bật lặp lần đầu cũng đi đường này: repeat_daily +
      // repeat_days đều là cột thật, ghi thẳng lên task — nó trở thành template).
      const fields = Object.keys(updates) as (keyof TaskUpdate)[];
      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map((f) => updates[f]);
      await db.execute(`UPDATE tasks SET ${setClauses} WHERE id = $1`, [id, ...values]);
      await get().loadTasks(get().selectedDate);
      syncCalendarFields();
      bumpScheduleVersion();
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

    if (scheduleChanged) {
      await db.execute('UPDATE tasks SET repeat_days = $1 WHERE id = $2', [nextSchedule, templateId]);
      // Instance tương lai chưa xong đã được tạo theo lịch cũ (sai thứ / sai giờ) → xoá để
      // loadTasks / ensureRepeatInstances tạo lại theo lịch mới. Hôm nay trở về trước giữ
      // nguyên; task đang sửa cũng giữ (giờ của nó lấy từ ô Bắt đầu/Kết thúc của modal).
      // Hoàn tác (Ctrl+Z) ghi lại lịch cũ → các buổi tương lai được tạo lại theo lịch cũ.
      const today = format(new Date(), 'yyyy-MM-dd');
      const staleWhere = 'series_id = $1 AND date > $2 AND is_done = 0 AND id != $3';
      const staleArgs = [templateId, today, id];
      const stale = await db.select<{ id: number }[]>(`SELECT id FROM tasks WHERE ${staleWhere}`, staleArgs);
      if (stale.length) {
        await db.execute(`DELETE FROM task_time_entries WHERE task_id IN (SELECT id FROM tasks WHERE ${staleWhere})`, staleArgs);
        await db.execute(`DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE ${staleWhere})`, staleArgs);
        await db.execute(`DELETE FROM tasks WHERE ${staleWhere}`, staleArgs);
        dropFromState(get, set, new Set(stale.map((r) => r.id)));
      }
    }

    // Handle repeat_daily toggle
    if ('repeat_daily' in updates) {
      if (turningOff) {
        // Turning OFF: convert template to regular task and delete all instances
        const instances = await db.select<{ id: number }[]>('SELECT id FROM tasks WHERE series_id = $1', [templateId]);
        await db.execute('DELETE FROM task_time_entries WHERE task_id IN (SELECT id FROM tasks WHERE series_id = $1)', [templateId]);
        await db.execute('DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE series_id = $1)', [templateId]);
        await db.execute('DELETE FROM tasks WHERE series_id = $1', [templateId]);
        await db.execute('UPDATE tasks SET repeat_daily = 0, series_id = NULL, repeat_end_date = NULL, repeat_days = NULL WHERE id = $1', [templateId]);
        dropFromState(get, set, new Set(instances.map((r) => r.id)));
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
    syncCalendarFields();
    bumpScheduleVersion();
  },

  toggleTask: async (id) => {
    // calendarTasks fallback: Today's week strip can tick tasks on other days.
    const task = get().tasks.find((t) => t.id === id) ?? get().calendarTasks.find((t) => t.id === id);
    if (!task) return;
    const newDone = task.is_done ? 0 : 1;

    // toggleTask tự đảo ngược chính nó — gọi lại là đủ để hoàn tác.
    get().pushHistory({ label: task.title, undo: () => get().toggleTask(id) });

    // Keep the calendar cache in sync too (Today week strip + Calendar read it).
    const syncCalendar = () =>
      set({ calendarTasks: get().calendarTasks.map((t) => (t.id === id ? { ...t, is_done: newDone } : t)) });

    if (!isTauri()) {
      dbUpdateTask(id, { is_done: newDone });
      set({ tasks: dbGetTasks(get().selectedDate) });
      syncCalendar();
      return;
    }

    const db = await getDb();
    await db.execute('UPDATE tasks SET is_done = $1 WHERE id = $2', [newDone, id]);
    await get().loadTasks(get().selectedDate);
    syncCalendar();
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
    // undoDeleteTask() luôn phục hồi ĐÚNG pendingDeleteTask hiện tại (slot đơn),
    // và vì stack là LIFO còn slot chỉ giữ bản xoá gần nhất, entry này luôn khớp
    // đúng task của chính nó khi được pop ra — kể cả khi có nhiều lần xoá liên tiếp.
    get().pushHistory({ label: task.title, undo: () => get().undoDeleteTask() });
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
    // Chuỗi lặp: DB xoá mọi instance từ ngày này trở đi (cả chuỗi nếu là ngày đầu), gồm
    // các buổi tương lai đã tạo trước cho dải tuần → gỡ chúng khỏi state luôn.
    const seriesId = task.series_id ?? (task.repeat_daily === 1 ? task.id : null);
    const removeIds = new Set<number>([task.id]);
    if (seriesId != null) {
      for (const t of [...get().tasks, ...get().calendarTasks]) {
        if (t.series_id === seriesId && t.date >= task.date) removeIds.add(t.id);
      }
    }
    set({ pendingDeleteTask: null });
    dropFromState(get, set, removeIds);
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
    // updateTaskColor ghi đè color của MỌI task cùng category (kể cả những task
    // đang có màu riêng khác category) — snapshot từng task để hoàn tác chính xác
    // từng cái, không chỉ đơn giản gọi lại với màu category cũ.
    const prevCategoryColor = get().categoryColors[category];
    const prevTaskColors = new Map<number, string | null>();
    for (const t of [...get().tasks, ...get().calendarTasks]) {
      if (t.category === category) prevTaskColors.set(t.id, t.color);
    }

    const mapper = (t: Task) => t.category === category ? { ...t, color } : t;
    const newCategoryColors = { ...get().categoryColors, [category]: color };
    set({
      tasks: get().tasks.map(mapper),
      calendarTasks: get().calendarTasks.map(mapper),
      categoryColors: newCategoryColors,
    });
    if (!isTauri()) {
      localStorage.setItem('categoryColors', JSON.stringify(newCategoryColors));
    } else {
      const db = await getDb();
      await db.execute('UPDATE tasks SET color = $1 WHERE category = $2', [color, category]);
      await db.execute(
        'INSERT OR REPLACE INTO category_colors (category, color) VALUES ($1, $2)',
        [category, color]
      );
    }

    get().pushHistory({
      label: category,
      undo: async () => {
        const restoreMapper = (t: Task) =>
          prevTaskColors.has(t.id) ? { ...t, color: prevTaskColors.get(t.id)! } : t;
        const restoredCategoryColors = { ...get().categoryColors, [category]: prevCategoryColor };
        set({
          tasks: get().tasks.map(restoreMapper),
          calendarTasks: get().calendarTasks.map(restoreMapper),
          categoryColors: restoredCategoryColors,
        });
        if (!isTauri()) {
          localStorage.setItem('categoryColors', JSON.stringify(restoredCategoryColors));
          return;
        }
        const db = await getDb();
        for (const [taskId, prevColor] of prevTaskColors) {
          await db.execute('UPDATE tasks SET color = $1 WHERE id = $2', [prevColor, taskId]);
        }
        await db.execute(
          'INSERT OR REPLACE INTO category_colors (category, color) VALUES ($1, $2)',
          [category, prevCategoryColor]
        );
      },
    });
  },

  reorderDeckTasks: async (orderedTaskIds) => {
    const date = get().selectedDate;
    const taskLookup = get().tasks;
    // Thứ tự deck_position hiện tại (trước khi ghi đè) chính là "trạng thái cũ"
    // cần khôi phục khi hoàn tác — gọi lại reorderDeckTasks với thứ tự này.
    const idSet = new Set(orderedTaskIds);
    const prevOrderedIds = [...taskLookup]
      .filter((t) => idSet.has(t.id))
      .sort((a, b) => (a.deck_position ?? 0) - (b.deck_position ?? 0))
      .map((t) => t.id);

    const positions = new Map(orderedTaskIds.map((id, i) => [id, i]));
    const mapper = (t: Task) => (positions.has(t.id) ? { ...t, deck_position: positions.get(t.id)! } : t);
    set({ tasks: get().tasks.map(mapper), calendarTasks: get().calendarTasks.map(mapper) });
    if (!isTauri()) {
      dbReorderDeckTasks(orderedTaskIds, date);
    } else {
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
    }

    get().pushHistory({
      label: '',
      undo: () => get().reorderDeckTasks(prevOrderedIds),
    });
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
