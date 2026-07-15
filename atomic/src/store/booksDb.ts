import { isTauri } from './mockDb';
import type { Book, BookStatus, NewBook } from '../types';

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb() {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}

type BookRow = {
  id: number;
  title: string;
  author: string | null;
  cover_image: string | null;
  status: BookStatus;
  finished_date: string | null;
  notes: string | null;
  created_at: string;
};

async function rowToBook(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BookRow
): Promise<Book> {
  const tagRows = await db.select<{ tag: string }[]>(
    'SELECT tag FROM book_tags WHERE book_id = $1 ORDER BY tag',
    [row.id]
  );
  return { ...row, tags: tagRows.map((t) => t.tag) };
}

export async function dbGetBooks(opts: {
  status?: BookStatus;
  year?: number;
  tag?: string;
  search?: string;
} = {}): Promise<Book[]> {
  if (!isTauri()) return [];
  const db = await getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.status) {
    conditions.push(`status = $${idx++}`);
    params.push(opts.status);
  }

  if (opts.year) {
    conditions.push(`CAST(strftime('%Y', COALESCE(finished_date, created_at)) AS INTEGER) = $${idx++}`);
    params.push(opts.year);
  }

  if (opts.tag) {
    conditions.push(`id IN (SELECT book_id FROM book_tags WHERE tag = $${idx++})`);
    params.push(opts.tag);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.select<BookRow[]>(
    `SELECT * FROM books ${where} ORDER BY COALESCE(finished_date, created_at) DESC`,
    params
  );
  const books = await Promise.all(rows.map((r) => rowToBook(db, r)));

  const search = opts.search?.trim().toLowerCase();
  if (!search) return books;
  return books.filter(
    (b) => b.title.toLowerCase().includes(search) || (b.author ?? '').toLowerCase().includes(search)
  );
}

export async function dbGetBookById(id: number): Promise<Book | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const rows = await db.select<BookRow[]>('SELECT * FROM books WHERE id = $1', [id]);
  return rows.length ? rowToBook(db, rows[0]) : null;
}

export async function dbAddBook(data: NewBook): Promise<Book | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO books (title, author, cover_image, status, finished_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.title,
      data.author || null,
      data.cover_image || null,
      data.status,
      data.finished_date || null,
      data.notes || null,
    ]
  );
  const id = result.lastInsertId;
  for (const tag of data.tags ?? []) {
    const t = tag.trim();
    if (t) {
      await db.execute(
        'INSERT OR IGNORE INTO book_tags (book_id, tag) VALUES ($1, $2)',
        [id, t]
      );
      await db.execute('INSERT OR IGNORE INTO book_tag_pool (tag) VALUES ($1)', [t]);
    }
  }
  const rows = await db.select<BookRow[]>('SELECT * FROM books WHERE id = $1', [id]);
  return rows.length ? rowToBook(db, rows[0]) : null;
}

export async function dbUpdateBook(id: number, data: NewBook): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute(
    `UPDATE books SET title = $1, author = $2, cover_image = $3, status = $4, finished_date = $5, notes = $6
     WHERE id = $7`,
    [
      data.title,
      data.author || null,
      data.cover_image || null,
      data.status,
      data.finished_date || null,
      data.notes || null,
      id,
    ]
  );
  await db.execute('DELETE FROM book_tags WHERE book_id = $1', [id]);
  for (const tag of data.tags ?? []) {
    const t = tag.trim();
    if (t) {
      await db.execute(
        'INSERT OR IGNORE INTO book_tags (book_id, tag) VALUES ($1, $2)',
        [id, t]
      );
      await db.execute('INSERT OR IGNORE INTO book_tag_pool (tag) VALUES ($1)', [t]);
    }
  }
}

export async function dbDeleteBook(id: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM book_tags WHERE book_id = $1', [id]);
  await db.execute('DELETE FROM books WHERE id = $1', [id]);
}

export async function dbGetYearsWithCounts(): Promise<
  { year: number; total: number; finished: number; reading: number; wantToRead: number }[]
> {
  if (!isTauri()) return [];
  const db = await getDb();
  return db.select<{ year: number; total: number; finished: number; reading: number; wantToRead: number }[]>(
    `SELECT
       CAST(strftime('%Y', COALESCE(finished_date, created_at)) AS INTEGER) as year,
       COUNT(*) as total,
       SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished,
       SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) as reading,
       SUM(CASE WHEN status = 'want_to_read' THEN 1 ELSE 0 END) as wantToRead
     FROM books
     GROUP BY year
     ORDER BY year DESC`
  );
}

export async function dbGetBookStats(): Promise<{ total: number; finished: number; reading: number; wantToRead: number }> {
  if (!isTauri()) return { total: 0, finished: 0, reading: 0, wantToRead: 0 };
  const db = await getDb();
  const rows = await db.select<{ total: number; finished: number; reading: number; wantToRead: number }[]>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished,
       SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) as reading,
       SUM(CASE WHEN status = 'want_to_read' THEN 1 ELSE 0 END) as wantToRead
     FROM books`
  );
  return {
    total: rows[0]?.total ?? 0,
    finished: rows[0]?.finished ?? 0,
    reading: rows[0]?.reading ?? 0,
    wantToRead: rows[0]?.wantToRead ?? 0,
  };
}

export async function dbGetAllBookTagNames(): Promise<string[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  const rows = await db.select<{ tag: string }[]>(
    'SELECT tag FROM book_tag_pool ORDER BY tag'
  );
  return rows.map((r) => r.tag);
}

export async function dbCreateBookTag(name: string): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('INSERT OR IGNORE INTO book_tag_pool (tag) VALUES ($1)', [name]);
}

export async function dbGetTagCounts(year?: number): Promise<{ tag: string; count: number }[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  if (year) {
    return db.select<{ tag: string; count: number }[]>(
      `SELECT bt.tag as tag, COUNT(*) as count
       FROM book_tags bt
       JOIN books b ON b.id = bt.book_id
       WHERE CAST(strftime('%Y', COALESCE(b.finished_date, b.created_at)) AS INTEGER) = $1
       GROUP BY bt.tag ORDER BY count DESC`,
      [year]
    );
  }
  return db.select<{ tag: string; count: number }[]>(
    'SELECT tag, COUNT(*) as count FROM book_tags GROUP BY tag ORDER BY count DESC'
  );
}

export async function dbRenameBookTag(oldName: string, newName: string): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('UPDATE book_tags SET tag = $1 WHERE tag = $2', [newName, oldName]);
  await db.execute('INSERT OR IGNORE INTO book_tag_pool (tag) VALUES ($1)', [newName]);
  await db.execute('DELETE FROM book_tag_pool WHERE tag = $1', [oldName]);
}

export async function dbDeleteBookTag(name: string): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM book_tags WHERE tag = $1', [name]);
  await db.execute('DELETE FROM book_tag_pool WHERE tag = $1', [name]);
}

export async function dbGetReadingGoal(year: number): Promise<number | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const rows = await db.select<{ goal: number }[]>(
    'SELECT goal FROM book_reading_goals WHERE year = $1',
    [year]
  );
  return rows.length ? rows[0].goal : null;
}

export async function dbSetReadingGoal(year: number, goal: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute(
    `INSERT INTO book_reading_goals (year, goal) VALUES ($1, $2)
     ON CONFLICT(year) DO UPDATE SET goal = excluded.goal`,
    [year, goal]
  );
}

// ── Dev seed data ──────────────────────────────────────────────────────────

function coverPlaceholder(hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex}"/><stop offset="1" stop-color="${hex}" stop-opacity="0.55"/></linearGradient></defs><rect width="240" height="360" fill="url(#g)"/><rect width="10" height="360" fill="rgba(0,0,0,0.18)"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const SEED_COVER_COLORS = [
  '#E67C73', '#F4511E', '#33B679', '#0B8043', '#039BE5',
  '#3F51B5', '#8E24AA', '#AB47BC', '#546E7A', '#4DB6AC',
];

export async function seedBooksIfEmpty(): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM books');
  if (rows[0].c > 0) return;

  const seed: NewBook[] = [
    { title: 'Đắc Nhân Tâm', author: 'Dale Carnegie', status: 'finished', finished_date: '2023-02-14', tags: ['Kỹ năng sống'] },
    { title: 'Nhà Giả Kim', author: 'Paulo Coelho', status: 'finished', finished_date: '2023-05-20', tags: ['Tiểu thuyết', 'Triết học'], notes: 'Đọc lại lần 2, vẫn thấy hay.' },
    { title: '1984', author: 'George Orwell', status: 'finished', finished_date: '2023-08-09', tags: ['Tiểu thuyết'] },
    { title: 'Người Giàu Có Nhất Thành Babylon', author: 'George S. Clason', status: 'finished', finished_date: '2023-11-30', tags: ['Tài chính'] },
    { title: 'Sapiens: Lược Sử Loài Người', author: 'Yuval Noah Harari', status: 'finished', finished_date: '2024-01-18', tags: ['Khoa học', 'Lịch sử'], notes: 'Góc nhìn thú vị về lịch sử loài người.' },
    { title: 'Tư Duy Nhanh Và Chậm', author: 'Daniel Kahneman', status: 'finished', finished_date: '2024-03-22', tags: ['Tâm lý học', 'Khoa học'] },
    { title: 'Rừng Na Uy', author: 'Haruki Murakami', status: 'finished', finished_date: '2024-06-10', tags: ['Tiểu thuyết'] },
    { title: 'Nghĩ Giàu Làm Giàu', author: 'Napoleon Hill', status: 'finished', finished_date: '2024-08-15', tags: ['Tài chính', 'Kỹ năng sống'] },
    { title: 'Totto-chan Bên Cửa Sổ', author: 'Tetsuko Kuroyanagi', status: 'finished', finished_date: '2024-12-02', tags: ['Tiểu thuyết'], notes: 'Ấm áp và đầy cảm hứng về giáo dục.' },
    { title: 'Homo Deus', author: 'Yuval Noah Harari', status: 'finished', finished_date: '2025-02-05', tags: ['Khoa học', 'Lịch sử'] },
    { title: 'Atomic Habits', author: 'James Clear', status: 'finished', finished_date: '2025-03-14', tags: ['Kỹ năng sống'], notes: 'Áp dụng nguyên tắc cải thiện 1% mỗi ngày.' },
    { title: 'Cà Phê Cùng Tony', author: 'Tony Buổi Sáng', status: 'finished', finished_date: '2025-04-30', tags: ['Kỹ năng sống'] },
    { title: 'Kafka Bên Bờ Biển', author: 'Haruki Murakami', status: 'finished', finished_date: '2025-07-19', tags: ['Tiểu thuyết'] },
    { title: 'Bí Mật Tư Duy Triệu Phú', author: 'T. Harv Eker', status: 'finished', finished_date: '2025-09-08', tags: ['Tài chính'] },
    { title: 'Điểm Đến Của Cuộc Đời', author: 'Đặng Hoàng Giang', status: 'finished', finished_date: '2025-11-25', tags: ['Tâm lý học'] },
    { title: 'Deep Work', author: 'Cal Newport', status: 'finished', finished_date: '2026-01-10', tags: ['Kỹ năng sống'] },
    { title: 'Muôn Kiếp Nhân Sinh', author: 'Nguyên Phong', status: 'finished', finished_date: '2026-03-02', tags: ['Triết học', 'Tâm linh'], notes: 'Đọc chậm, suy ngẫm nhiều.' },
    { title: 'Tuổi Trẻ Đáng Giá Bao Nhiêu', author: 'Rosie Nguyễn', status: 'finished', finished_date: '2026-04-18', tags: ['Kỹ năng sống'] },
    { title: 'Khéo Ăn Nói Sẽ Có Được Thiên Hạ', author: 'Trác Nhã', status: 'finished', finished_date: '2026-06-25', tags: ['Kỹ năng sống'] },
    { title: 'Nhà Lãnh Đạo Không Chức Danh', author: 'Robin Sharma', status: 'reading', tags: ['Kỹ năng sống'] },
    { title: 'Súng, Vi Trùng Và Thép', author: 'Jared Diamond', status: 'reading', tags: ['Lịch sử', 'Khoa học'] },
    { title: 'Hoàng Tử Bé', author: 'Antoine de Saint-Exupéry', status: 'reading', tags: ['Tiểu thuyết'] },
    { title: 'Bàn Về Tự Do', author: 'John Stuart Mill', status: 'want_to_read', tags: ['Triết học'] },
    { title: 'Bước Chậm Lại Giữa Thế Gian Vội Vã', author: 'Hae Min', status: 'want_to_read', tags: ['Tâm lý học'] },
    { title: 'Bí Mật Của May Mắn', author: 'Alex Rovira', status: 'want_to_read', tags: ['Kỹ năng sống'] },
  ];

  for (let i = 0; i < seed.length; i++) {
    await dbAddBook({ ...seed[i], cover_image: coverPlaceholder(SEED_COVER_COLORS[i % SEED_COVER_COLORS.length]) });
  }

  await dbSetReadingGoal(new Date().getFullYear(), 24);
}
