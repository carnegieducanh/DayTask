import { isTauri } from './mockDb';
import type { JournalEntry, JournalType, JournalStats } from '../types';

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb() {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}

type DbRow = {
  id: number; date: string; type: string;
  items: string; created_at: string; updated_at: string;
};

function rowToEntry(r: DbRow): JournalEntry {
  let items: string[];
  try {
    const raw = r.items;
    items = Array.isArray(raw) ? raw : JSON.parse(raw as unknown as string);
  } catch {
    items = [];
  }
  return {
    id: r.id, date: r.date, type: r.type as JournalType,
    items, created_at: r.created_at, updated_at: r.updated_at,
  };
}

export async function dbGetJournal(date: string, type: JournalType): Promise<JournalEntry | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const rows = await db.select<DbRow[]>(
    'SELECT * FROM journal_entries WHERE date = $1 AND type = $2 LIMIT 1',
    [date, type]
  );
  return rows.length ? rowToEntry(rows[0]) : null;
}

export async function dbSaveJournal(
  date: string, type: JournalType, items: string[]
): Promise<JournalEntry | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const itemsJson = JSON.stringify(items.filter(i => i.trim()));
  const existing = await dbGetJournal(date, type);
  if (existing) {
    await db.execute(
      'UPDATE journal_entries SET items = $1, updated_at = datetime(\'now\') WHERE id = $2',
      [itemsJson, existing.id]
    );
  } else {
    await db.execute(
      'INSERT INTO journal_entries (date, type, items) VALUES ($1, $2, $3)',
      [date, type, itemsJson]
    );
  }
  return dbGetJournal(date, type);
}

export async function dbDeleteJournal(id: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM journal_entries WHERE id = $1', [id]);
}

export async function dbGetJournalHistory(
  type: JournalType, excludeDate: string, limit: number, offset: number
): Promise<JournalEntry[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  const rows = await db.select<DbRow[]>(
    'SELECT * FROM journal_entries WHERE type = $1 AND date != $2 ORDER BY date DESC LIMIT $3 OFFSET $4',
    [type, excludeDate, limit, offset]
  );
  return rows.map(rowToEntry);
}

export async function dbGetJournalStreak(): Promise<number> {
  if (!isTauri()) return 0;
  const db = await getDb();
  const rows = await db.select<{ date: string }[]>(
    'SELECT DISTINCT date FROM journal_entries ORDER BY date DESC'
  );
  if (!rows.length) return 0;
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let current = cursor;
  for (const row of rows) {
    const d = new Date(row.date + 'T00:00:00');
    const diff = Math.round((current.getTime() - d.getTime()) / 86400000);
    if (diff > 1) break;
    streak++;
    current = d;
  }
  return streak;
}

export async function dbGetJournalStats(year: number, month: number): Promise<JournalStats> {
  if (!isTauri()) return { gratitudeDays: 0, lessonDays: 0 };
  const db = await getDb();
  const monthStr = String(month).padStart(2, '0');
  const rows = await db.select<{ type: string; cnt: number }[]>(
    'SELECT type, COUNT(DISTINCT date) as cnt FROM journal_entries WHERE date LIKE $1 GROUP BY type',
    [`${year}-${monthStr}-%`]
  );
  const result = { gratitudeDays: 0, lessonDays: 0 };
  for (const r of rows) {
    if (r.type === 'gratitude') result.gratitudeDays = r.cnt;
    else if (r.type === 'lesson') result.lessonDays = r.cnt;
  }
  return result;
}

export async function dbGetDatesWithEntries(year: number, month: number): Promise<string[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  const monthStr = String(month).padStart(2, '0');
  const rows = await db.select<{ date: string }[]>(
    'SELECT DISTINCT date FROM journal_entries WHERE date LIKE $1',
    [`${year}-${monthStr}-%`]
  );
  return rows.map(r => r.date);
}

export async function seedJournalIfEmpty(): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM journal_entries');
  if (rows[0].c > 0) return;

  const GRATITUDE_POOL: string[][] = [
    ['Cốc cà phê buổi sáng thơm và ấm', 'Trời nắng đẹp sau mấy ngày mưa', 'Được ngủ đủ giấc tối qua'],
    ['Bữa cơm nhà ngon và đủ chất', 'Đồng nghiệp hỗ trợ khi mình bận', 'Sức khỏe tốt, không đau nhức gì'],
    ['Hoàn thành task khó trước deadline', 'Nhận được tin nhắn từ người bạn cũ', 'Ngày làm việc suôn sẻ không vấn đề gì'],
    ['Buổi chiều đi bộ trong công viên', 'Đọc được cuốn sách hay đang dang dở', 'Có thời gian nấu ăn cho bản thân'],
    ['Học được điều mới từ video hướng dẫn', 'Mẹ gọi điện hỏi thăm', 'Phòng làm việc yên tĩnh và thoải mái'],
    ['Cơ thể khỏe mạnh để làm điều mình thích', 'Có đủ tiền chi trả mọi chi phí tháng này', 'Dự án tiến triển đúng hướng'],
    ['Ngủ đủ giấc và tỉnh dậy sảng khoái', 'Bạn bè vui vẻ trong buổi tụ họp nhỏ', 'Tìm ra giải pháp cho vấn đề từ lâu'],
    ['Ánh nắng buổi sáng qua cửa sổ', 'Trà xanh nóng vào buổi chiều', 'Kết thúc ngày làm việc đúng giờ'],
    ['Internet ổn định trong ngày làm việc online', 'Ăn sáng ngon và no bụng', 'Được nghe bài nhạc yêu thích tình cờ'],
    ['Hoàn thành danh sách việc cần làm trong ngày', 'Nhận được phản hồi tích cực từ người dùng', 'Buổi tối thư giãn xem phim yêu thích'],
    ['Cà phê pha vừa đúng khẩu vị', 'Thành phố yên tĩnh vào buổi sáng sớm', 'Có người nghe mình chia sẻ khó khăn'],
    ['Một ngày không có cuộc họp nào cả', 'Tìm được thứ đã mất từ lâu', 'Đọc tin tức tốt thay vì tin xấu'],
    ['Học được kỹ năng mới mà lâu nay muốn học', 'Cơn mưa làm không khí trong lành hơn', 'Được làm việc từ nhà thoải mái'],
    ['Có deadline rõ ràng giúp mình tập trung', 'Buổi sáng không kẹt xe', 'Người thân khỏe mạnh'],
  ];

  const LESSON_POOL: string[] = [
    'Khi tập trung vào 1 việc thay vì multitask, năng suất tăng hẳn.',
    'Nói "không" đúng lúc giúp tiết kiệm rất nhiều năng lượng.',
    'Bắt đầu ngay dù chưa sẵn sàng còn tốt hơn là chờ thời điểm hoàn hảo.',
    'Nghỉ ngơi đúng cách không phải lãng phí — đó là đầu tư cho hiệu suất.',
    'Đặt câu hỏi sớm hơn giúp tránh đi sai hướng mãi sau mới phát hiện.',
    'Viết ra vấn đề thường giúp nhìn thấy giải pháp rõ hơn là chỉ nghĩ trong đầu.',
    'Cảm xúc tiêu cực mà không được nhận ra sẽ ảnh hưởng đến quyết định.',
    'Giao việc và tin tưởng người khác tốt hơn là ôm hết mọi việc một mình.',
    'Sự đơn giản thường là giải pháp tốt nhất — phức tạp chỉ tạo thêm điểm lỗi.',
    'Giải thích vấn đề cho người khác giúp mình hiểu rõ hơn gấp đôi.',
    'Thói quen nhỏ mỗi ngày tích lũy thành thay đổi lớn sau vài tháng.',
    'Ăn no và ngủ đủ không phải điều hiển nhiên — cần chủ động đảm bảo.',
    'Phản hồi chân thành, dù khó nghe, có giá trị hơn lời khen xã giao.',
    'Dành thời gian lập kế hoạch tiết kiệm nhiều thời gian thực hiện hơn.',
  ];

  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    await db.execute(
      'INSERT INTO journal_entries (date, type, items) VALUES ($1, $2, $3)',
      [dateStr, 'gratitude', JSON.stringify(GRATITUDE_POOL[i - 1])]
    );
    await db.execute(
      'INSERT INTO journal_entries (date, type, items) VALUES ($1, $2, $3)',
      [dateStr, 'lesson', JSON.stringify([LESSON_POOL[i - 1]])]
    );
  }
}
