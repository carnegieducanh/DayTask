import type { StateCreator } from 'zustand';
import type { Tag } from '../../types';
import { isTauri, dbGetTags, dbAddTag, dbUpdateTag, dbDeleteTag, dbGetTaskTagsForDate, dbSetTaskTags } from '../mockDb';
import { getDb } from '../db';
import type { AppState } from '../appStore';

const TAG_COLORS = [
  '#60A5FA', '#34D399', '#FB923C', '#A78BFA',
  '#F472B6', '#2DD4BF', '#FACC15', '#818CF8',
  '#4ADE80', '#F87171', '#E879F9', '#38BDF8',
];

export interface TagSlice {
  tags: Tag[];
  taskTags: Record<number, number[]>;
  pendingDeleteTag: Tag | null;

  loadTags: () => Promise<void>;
  loadTaskTagsForDate: (date: string) => Promise<void>;
  addTag: (name: string) => Promise<number>;
  updateTag: (id: number, name: string) => Promise<void>;
  deleteTag: (id: number) => Promise<void>;
  softDeleteTag: (id: number) => void;
  undoDeleteTag: () => void;
  confirmDeleteTag: (tag: Tag) => Promise<void>;
  setTaskTags: (taskId: number, tagIds: number[]) => Promise<void>;
}

export const createTagSlice: StateCreator<AppState, [], [], TagSlice> = (set, get) => ({
  tags: [],
  taskTags: {},
  pendingDeleteTag: null,

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
    const tag = get().tags.find((t) => t.id === id);
    if (tag) {
      const prevName = tag.name;
      get().pushHistory({ label: prevName, undo: () => get().updateTag(id, prevName) });
    }

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
    get().pushHistory({ label: tag.name, undo: () => get().undoDeleteTag() });
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
});
