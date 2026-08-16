import type { StateCreator } from 'zustand';
import type Database from '@tauri-apps/plugin-sql';
import type { DayActivity, DayDuration, TagStat, CategoryStat, MonthStat } from '../../types';
import { isTauri, dbGetHeatmap, dbGetStreak } from '../mockDb';
import { getDb } from '../db';
import type { AppState } from '../appStore';

type SortBy = 'tasks' | 'minutes';

async function queryCategoryStats(db: Database, startDate: string, endDate: string, sortBy: SortBy): Promise<CategoryStat[]> {
  const orderClause = sortBy === 'minutes' ? 'ORDER BY minutes DESC, tasks DESC' : 'ORDER BY tasks DESC, minutes DESC';
  return db.select<CategoryStat[]>(
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
}

async function queryTagStats(db: Database, startDate: string, endDate: string, sortBy: SortBy): Promise<TagStat[]> {
  const orderClause = sortBy === 'minutes' ? 'ORDER BY minutes DESC, tasks DESC' : 'ORDER BY tasks DESC, minutes DESC';
  return db.select<TagStat[]>(
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
}

export interface HeatmapSlice {
  heatmap: DayActivity[];
  heatmapDurations: DayDuration[];
  heatmapMonthStats: MonthStat[];
  heatmapTopTagHours: { name: string; color: string; minutes: number } | null;

  // Week tier — top categories/tags this week + previous week (for comparison)
  heatmapWeekCategoryStats: CategoryStat[];
  heatmapWeekCategoryStatsPrev: CategoryStat[];
  heatmapWeekTagStats: TagStat[];
  heatmapWeekTagStatsPrev: TagStat[];

  // Month tier — top categories/tags this month + previous month (for comparison)
  heatmapMonthCategoryStats: CategoryStat[];
  heatmapMonthCategoryStatsPrev: CategoryStat[];
  heatmapMonthTagStats: TagStat[];
  heatmapMonthTagStatsPrev: TagStat[];

  loadHeatmap: (year: number) => Promise<void>;
  loadHeatmapDurations: (year: number) => Promise<void>;
  loadHeatmapMonthStats: (year: number) => Promise<void>;
  loadHeatmapTopTagHours: (yearMonthPrefix: string) => Promise<void>;
  getStreak: () => Promise<number>;

  loadHeatmapWeekCategoryStats: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;
  loadHeatmapWeekCategoryStatsPrev: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;
  loadHeatmapWeekTagStats: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;
  loadHeatmapWeekTagStatsPrev: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;

  loadHeatmapMonthCategoryStats: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;
  loadHeatmapMonthCategoryStatsPrev: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;
  loadHeatmapMonthTagStats: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;
  loadHeatmapMonthTagStatsPrev: (startDate: string, endDate: string, sortBy: SortBy) => Promise<void>;
}

export const createHeatmapSlice: StateCreator<AppState, [], [], HeatmapSlice> = (set) => ({
  heatmap: [],
  heatmapDurations: [],
  heatmapMonthStats: [],
  heatmapTopTagHours: null,

  heatmapWeekCategoryStats: [],
  heatmapWeekCategoryStatsPrev: [],
  heatmapWeekTagStats: [],
  heatmapWeekTagStatsPrev: [],

  heatmapMonthCategoryStats: [],
  heatmapMonthCategoryStatsPrev: [],
  heatmapMonthTagStats: [],
  heatmapMonthTagStatsPrev: [],

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

  loadHeatmapWeekCategoryStats: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapWeekCategoryStats: [] }); return; }
    const db = await getDb();
    set({ heatmapWeekCategoryStats: await queryCategoryStats(db, startDate, endDate, sortBy) });
  },
  loadHeatmapWeekCategoryStatsPrev: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapWeekCategoryStatsPrev: [] }); return; }
    const db = await getDb();
    set({ heatmapWeekCategoryStatsPrev: await queryCategoryStats(db, startDate, endDate, sortBy) });
  },
  loadHeatmapWeekTagStats: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapWeekTagStats: [] }); return; }
    const db = await getDb();
    set({ heatmapWeekTagStats: await queryTagStats(db, startDate, endDate, sortBy) });
  },
  loadHeatmapWeekTagStatsPrev: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapWeekTagStatsPrev: [] }); return; }
    const db = await getDb();
    set({ heatmapWeekTagStatsPrev: await queryTagStats(db, startDate, endDate, sortBy) });
  },

  loadHeatmapMonthCategoryStats: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapMonthCategoryStats: [] }); return; }
    const db = await getDb();
    set({ heatmapMonthCategoryStats: await queryCategoryStats(db, startDate, endDate, sortBy) });
  },
  loadHeatmapMonthCategoryStatsPrev: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapMonthCategoryStatsPrev: [] }); return; }
    const db = await getDb();
    set({ heatmapMonthCategoryStatsPrev: await queryCategoryStats(db, startDate, endDate, sortBy) });
  },
  loadHeatmapMonthTagStats: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapMonthTagStats: [] }); return; }
    const db = await getDb();
    set({ heatmapMonthTagStats: await queryTagStats(db, startDate, endDate, sortBy) });
  },
  loadHeatmapMonthTagStatsPrev: async (startDate, endDate, sortBy) => {
    if (!isTauri()) { set({ heatmapMonthTagStatsPrev: [] }); return; }
    const db = await getDb();
    set({ heatmapMonthTagStatsPrev: await queryTagStats(db, startDate, endDate, sortBy) });
  },
});
