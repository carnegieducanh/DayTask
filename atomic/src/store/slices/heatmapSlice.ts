import type { StateCreator } from 'zustand';
import type { DayActivity, DayDuration, TagStat, CategoryStat, MonthStat } from '../../types';
import { isTauri, dbGetHeatmap, dbGetStreak } from '../mockDb';
import { getDb } from '../db';
import type { AppState } from '../appStore';

export interface HeatmapSlice {
  heatmap: DayActivity[];
  heatmapDurations: DayDuration[];
  heatmapTagStats: TagStat[];
  heatmapCategoryStats: CategoryStat[];
  heatmapMonthStats: MonthStat[];
  heatmapTopTagHours: { name: string; color: string; minutes: number } | null;

  loadHeatmap: (year: number) => Promise<void>;
  loadHeatmapDurations: (year: number) => Promise<void>;
  loadHeatmapTagStats: (startDate: string, endDate: string, sortBy: 'tasks' | 'minutes') => Promise<void>;
  loadHeatmapCategoryStats: (startDate: string, endDate: string, sortBy: 'tasks' | 'minutes') => Promise<void>;
  loadHeatmapMonthStats: (year: number) => Promise<void>;
  loadHeatmapTopTagHours: (yearMonthPrefix: string) => Promise<void>;
  getStreak: () => Promise<number>;
}

export const createHeatmapSlice: StateCreator<AppState, [], [], HeatmapSlice> = (set) => ({
  heatmap: [],
  heatmapDurations: [],
  heatmapTagStats: [],
  heatmapCategoryStats: [],
  heatmapMonthStats: [],
  heatmapTopTagHours: null,

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
      `SELECT tte.date,
         COALESCE(SUM(
           (CAST(SUBSTR(tte.end_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.end_time, 4, 2) AS INTEGER)) -
           (CAST(SUBSTR(tte.start_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.start_time, 4, 2) AS INTEGER))
         ), 0) as minutes
       FROM task_time_entries tte
       JOIN tasks t ON t.id = tte.task_id
       WHERE tte.date LIKE $1 AND tte.end_time > tte.start_time AND t.is_done = 1
       GROUP BY tte.date`,
      [`${year}-%`]
    );
    set({ heatmapDurations: rows });
  },

  loadHeatmapTagStats: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapTagStats: [] }); return; }
    const db = await getDb();
    const orderClause = sortBy === 'minutes' ? 'ORDER BY minutes DESC, tasks DESC' : 'ORDER BY tasks DESC, minutes DESC';
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
       LEFT JOIN task_time_entries tte ON tte.task_id = t.id AND tte.date >= $1 AND tte.date <= $2
       WHERE t.date >= $1 AND t.date <= $2 AND t.is_done = 1
       GROUP BY tg.id
       ${orderClause}
       LIMIT 6`,
      [startDate, endDate]
    );
    set({ heatmapTagStats: rows });
  },

  loadHeatmapCategoryStats: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapCategoryStats: [] }); return; }
    const db = await getDb();
    const orderClause = sortBy === 'minutes' ? 'ORDER BY minutes DESC, tasks DESC' : 'ORDER BY tasks DESC, minutes DESC';
    const rows = await db.select<CategoryStat[]>(
      `SELECT t.category as category,
         COUNT(DISTINCT t.id) as tasks,
         COALESCE(SUM(
           CASE WHEN tte.end_time > tte.start_time THEN
             (CAST(SUBSTR(tte.end_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.end_time, 4, 2) AS INTEGER)) -
             (CAST(SUBSTR(tte.start_time, 1, 2) AS INTEGER) * 60 + CAST(SUBSTR(tte.start_time, 4, 2) AS INTEGER))
           ELSE 0 END
         ), 0) as minutes
       FROM tasks t
       LEFT JOIN task_time_entries tte ON tte.task_id = t.id AND tte.date >= $1 AND tte.date <= $2
       WHERE t.date >= $1 AND t.date <= $2 AND t.is_done = 1
       GROUP BY t.category
       ${orderClause}`,
      [startDate, endDate]
    );
    set({ heatmapCategoryStats: rows });
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
       WHERE tte.end_time > tte.start_time AND t.is_done = 1
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
});
