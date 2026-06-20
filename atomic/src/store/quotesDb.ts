import { isTauri } from './mockDb';
import type { Quote, QuoteHeroMode } from '../types';

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb() {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}

type QuoteRow = {
  id: number;
  text: string;
  author: string | null;
  language: string;
  is_favorite: number;
  created_at: string;
};

async function rowToQuote(
  db: Awaited<ReturnType<typeof getDb>>,
  row: QuoteRow
): Promise<Quote> {
  const tagRows = await db.select<{ tag: string }[]>(
    'SELECT tag FROM quote_tags WHERE quote_id = $1 ORDER BY tag',
    [row.id]
  );
  return { ...row, tags: tagRows.map((t) => t.tag) };
}

export async function dbGetQuotes(opts: {
  filter?: 'all' | 'favorites' | 'recent';
  language?: string;
  search?: string;
} = {}): Promise<Quote[]> {
  if (!isTauri()) return [];
  const db = await getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.filter === 'favorites') {
    conditions.push('is_favorite = 1');
  }

  if (opts.language) {
    conditions.push(`language = $${idx++}`);
    params.push(opts.language);
  }

  if (opts.search?.trim()) {
    conditions.push(`(text LIKE $${idx} OR COALESCE(author,'') LIKE $${idx})`);
    params.push(`%${opts.search.trim()}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.filter === 'recent' ? ' LIMIT 20' : '';

  const rows = await db.select<QuoteRow[]>(
    `SELECT * FROM quotes ${where} ORDER BY created_at DESC${limit}`,
    params
  );
  return Promise.all(rows.map((r) => rowToQuote(db, r)));
}

export async function dbGetQuoteById(id: number): Promise<Quote | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const rows = await db.select<QuoteRow[]>('SELECT * FROM quotes WHERE id = $1', [id]);
  return rows.length ? rowToQuote(db, rows[0]) : null;
}

export async function dbAddQuote(
  text: string,
  author: string | null,
  language: string,
  tags: string[]
): Promise<Quote | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO quotes (text, author, language) VALUES ($1, $2, $3)',
    [text, author || null, language]
  );
  const id = result.lastInsertId;
  for (const tag of tags) {
    const t = tag.trim();
    if (t) {
      await db.execute(
        'INSERT OR IGNORE INTO quote_tags (quote_id, tag) VALUES ($1, $2)',
        [id, t]
      );
    }
  }
  const rows = await db.select<QuoteRow[]>('SELECT * FROM quotes WHERE id = $1', [id]);
  return rows.length ? rowToQuote(db, rows[0]) : null;
}

export async function dbDeleteQuote(id: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM quote_tags WHERE quote_id = $1', [id]);
  await db.execute('DELETE FROM quotes WHERE id = $1', [id]);
}

export async function dbToggleQuoteFavorite(id: number, currentValue: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('UPDATE quotes SET is_favorite = $1 WHERE id = $2', [
    currentValue ? 0 : 1,
    id,
  ]);
}

export async function dbGetRandomQuote(favoritesOnly: boolean): Promise<Quote | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const where = favoritesOnly ? 'WHERE is_favorite = 1' : '';
  const rows = await db.select<QuoteRow[]>(
    `SELECT * FROM quotes ${where} ORDER BY RANDOM() LIMIT 1`
  );
  return rows.length ? rowToQuote(db, rows[0]) : null;
}

export async function dbGetLanguageCounts(): Promise<{ language: string; count: number }[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  return db.select<{ language: string; count: number }[]>(
    'SELECT language, COUNT(*) as count FROM quotes GROUP BY language ORDER BY count DESC'
  );
}

export async function dbGetQuoteCounts(): Promise<{ total: number; favorites: number }> {
  if (!isTauri()) return { total: 0, favorites: 0 };
  const db = await getDb();
  const rows = await db.select<{ total: number; favorites: number }[]>(
    `SELECT
       COUNT(*) as total,
       SUM(is_favorite) as favorites
     FROM quotes`
  );
  return { total: rows[0]?.total ?? 0, favorites: rows[0]?.favorites ?? 0 };
}

// ── Hero quote helpers (localStorage-backed) ──────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyCache(key: string): { date: string; id: number } | null {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function setDailyCache(key: string, id: number) {
  localStorage.setItem(key, JSON.stringify({ date: todayStr(), id }));
}
function clearDailyCache(key: string) {
  localStorage.removeItem(key);
}

export function getHeroModeLS(): QuoteHeroMode {
  return (localStorage.getItem('quote_hero_mode') as QuoteHeroMode) ?? 'random_daily';
}
export function setHeroModeLS(mode: QuoteHeroMode) {
  localStorage.setItem('quote_hero_mode', mode);
}
export function getPinnedIdLS(): number | null {
  const v = localStorage.getItem('quote_hero_pinned_id');
  return v !== null ? Number(v) : null;
}
export function setPinnedIdLS(id: number | null) {
  if (id === null) localStorage.removeItem('quote_hero_pinned_id');
  else localStorage.setItem('quote_hero_pinned_id', String(id));
}

export async function dbGetHeroQuote(mode: QuoteHeroMode): Promise<Quote | null> {
  if (!isTauri()) return null;

  if (mode === 'manual') {
    const pinned = getPinnedIdLS();
    return pinned ? dbGetQuoteById(pinned) : null;
  }

  const cacheKey =
    mode === 'random_daily' ? 'quote_hero_daily_random' : 'quote_hero_daily_fav';
  const cached = getDailyCache(cacheKey);
  const today = todayStr();

  if (cached?.date === today) {
    const q = await dbGetQuoteById(cached.id);
    if (q) return q;
  }

  const q = await dbGetRandomQuote(mode === 'random_favorites');
  if (q) setDailyCache(cacheKey, q.id);
  return q;
}

export function invalidateDailyCache() {
  clearDailyCache('quote_hero_daily_random');
  clearDailyCache('quote_hero_daily_fav');
}
