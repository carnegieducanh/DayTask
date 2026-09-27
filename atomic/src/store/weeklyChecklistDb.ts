import { isTauri } from './mockDb';
import { addWeeks, endOfWeek, format, isSameMonth, startOfISOWeekYear, startOfWeek, subDays } from 'date-fns';

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb() {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}

export interface WeeklyItem {
  id: number;
  week_key: string;
  text: string;
  is_done: boolean;
  position: number;
}

type DbRow = { id: number; week_key: string; text: string; is_done: number; position: number };

function rowToItem(r: DbRow): WeeklyItem {
  return { id: r.id, week_key: r.week_key, text: r.text, is_done: !!r.is_done, position: r.position };
}

// Weeks start on Sunday (same as the Today week strip and the Calendar tab)
// and are keyed by that Sunday's date, e.g. "2026-09-27".
export function getWeekKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
}

export function formatWeekRange(date: Date): string {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const end = endOfWeek(date, { weekStartsOn: 0 });
  if (isSameMonth(start, end)) {
    return `${format(start, 'd')}–${format(end, 'd MMM')}`;
  }
  return `${format(start, 'd MMM')}–${format(end, 'd MMM')}`;
}

export async function dbGetWeeklyItems(weekKey: string): Promise<WeeklyItem[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  const rows = await db.select<DbRow[]>(
    'SELECT * FROM weekly_checklist WHERE week_key = $1 ORDER BY position, id',
    [weekKey]
  );
  return rows.map(rowToItem);
}

// Keys used to be ISO weeks ("2026-W39", Mon–Sun). Move each to the Sunday
// week holding its Mon–Sat — the Sunday right before the ISO Monday. Runs on
// every load (cheap) so an old backup imported later gets converted too.
async function migrateLegacyWeekKeys(db: Awaited<ReturnType<typeof getDb>>) {
  const legacy = await db.select<{ week_key: string }[]>(
    "SELECT DISTINCT week_key FROM weekly_checklist WHERE week_key LIKE '%-W%'"
  );
  for (const { week_key } of legacy) {
    const m = /^(\d{4})-W(\d{2})$/.exec(week_key);
    if (!m) continue;
    // Jan 4 always falls in ISO week 1 of its year.
    const monday = addWeeks(startOfISOWeekYear(new Date(Number(m[1]), 0, 4)), Number(m[2]) - 1);
    await db.execute('UPDATE weekly_checklist SET week_key = $1 WHERE week_key = $2', [
      format(subDays(monday, 1), 'yyyy-MM-dd'),
      week_key,
    ]);
  }
}

// Loads run one at a time: two overlapping loads of an empty current week
// (StrictMode runs effects twice in dev) would both copy last week's items.
let loadQueue: Promise<unknown> = Promise.resolve();

export function dbLoadWeekItems(weekKey: string, todayWeekKey: string): Promise<WeeklyItem[]> {
  const run = loadQueue.then(() => loadWeekItems(weekKey, todayWeekKey));
  loadQueue = run.catch(() => {});
  return run;
}

async function loadWeekItems(weekKey: string, todayWeekKey: string): Promise<WeeklyItem[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  await migrateLegacyWeekKeys(db);

  const existing = await db.select<DbRow[]>(
    'SELECT * FROM weekly_checklist WHERE week_key = $1 ORDER BY position, id',
    [weekKey]
  );
  if (existing.length > 0) return existing.map(rowToItem);

  // Chỉ auto-copy khi đang ở tuần hiện tại và tuần đó chưa có data
  if (weekKey !== todayWeekKey) return [];

  const prev = await db.select<{ week_key: string }[]>(
    'SELECT DISTINCT week_key FROM weekly_checklist WHERE week_key < $1 ORDER BY week_key DESC LIMIT 1',
    [weekKey]
  );
  if (prev.length === 0) return [];

  const incomplete = await db.select<DbRow[]>(
    'SELECT * FROM weekly_checklist WHERE week_key = $1 AND is_done = 0 ORDER BY position, id',
    [prev[0].week_key]
  );
  if (incomplete.length === 0) return [];

  const newItems: WeeklyItem[] = [];
  for (const item of incomplete) {
    const result = await db.execute(
      'INSERT INTO weekly_checklist (week_key, text, position) VALUES ($1, $2, $3)',
      [weekKey, item.text, item.position]
    );
    if (result.lastInsertId) {
      newItems.push({ id: result.lastInsertId, week_key: weekKey, text: item.text, is_done: false, position: item.position });
    }
  }
  return newItems;
}

export async function dbAddWeeklyItem(weekKey: string, text: string, position: number): Promise<number> {
  if (!isTauri()) return -1;
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO weekly_checklist (week_key, text, position) VALUES ($1, $2, $3)',
    [weekKey, text, position]
  );
  return result.lastInsertId ?? -1;
}

export async function dbToggleWeeklyItem(id: number, isDone: boolean): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('UPDATE weekly_checklist SET is_done = $1 WHERE id = $2', [isDone ? 1 : 0, id]);
}

export async function dbUpdateWeeklyItem(id: number, text: string): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('UPDATE weekly_checklist SET text = $1 WHERE id = $2', [text, id]);
}

export async function dbDeleteWeeklyItem(id: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM weekly_checklist WHERE id = $1', [id]);
}
