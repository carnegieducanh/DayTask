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
  const itemsJson = JSON.stringify(items);
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
  type: JournalType, beforeDate: string
): Promise<JournalEntry[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  const rows = await db.select<DbRow[]>(
    'SELECT * FROM journal_entries WHERE type = $1 AND date < $2 ORDER BY date DESC LIMIT 50',
    [type, beforeDate]
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

  const LESSON_POOL: [string, string, string][] = [
    [
      'Dành 2 tiếng debug một lỗi logic sai kết quả tính toán.',
      'Tôi đã quá tin vào giả định đầu tiên mà không kiểm tra lại.',
      'Nhiều vấn đề khó không phải vì bản thân chúng khó, mà vì mình đang nhìn sai hướng.',
    ],
    [
      'Cuộc họp kéo dài hơn dự kiến vì thiếu agenda rõ ràng từ đầu.',
      'Khi không có mục tiêu cụ thể, mọi người dễ đi lạc vào chi tiết không cần thiết.',
      'Chuẩn bị agenda trước 5 phút tiết kiệm được 30 phút trong cuộc họp.',
    ],
    [
      'Thử giải thích một vấn đề kỹ thuật cho người không chuyên.',
      'Tôi nhận ra mình không thực sự hiểu rõ phần mình không giải thích được.',
      'Nếu không thể giải thích đơn giản, nghĩa là mình chưa hiểu đủ sâu.',
    ],
    [
      'Nhận được phản hồi thẳng thắn về cách trình bày của mình.',
      'Dù khó nghe nhưng đó chính xác là điều tôi cần để cải thiện.',
      'Phản hồi chân thành, dù khó chịu, có giá trị hơn sự im lặng lịch sự.',
    ],
    [
      'Cố gắng làm nhiều việc cùng lúc và kết quả tất cả đều nửa vời.',
      'Khi chuyển đổi liên tục, não cần thời gian "khởi động lại" cho từng việc.',
      'Tập trung hoàn toàn vào một việc hiệu quả hơn multitask gấp nhiều lần.',
    ],
    [
      'Trì hoãn một quyết định nhỏ vì "chưa có đủ thông tin".',
      'Tôi nhận ra mình đang tìm kiếm sự chắc chắn tuyệt đối — thứ không bao giờ tồn tại.',
      'Quyết định tốt không cần thông tin hoàn hảo, chỉ cần đủ để hành động.',
    ],
    [
      'Đọc lại code mình viết 3 tháng trước và không hiểu tại sao lại làm vậy.',
      'Ngay lúc viết, mọi thứ rõ ràng trong đầu — nhưng code không mang theo ngữ cảnh đó.',
      'Viết code cho người đọc sau, không phải cho mình lúc đang hiểu.',
    ],
    [
      'Nhận lời giúp đỡ một việc không thuộc chuyên môn mình vì không muốn từ chối.',
      'Kết quả mất nhiều thời gian hơn và chất lượng cũng không tốt như kỳ vọng.',
      'Nói không đúng lúc là tôn trọng cả hai bên — bản thân và người nhờ.',
    ],
    [
      'Giải pháp đầu tiên nghĩ ra có vẻ phức tạp nhưng vẫn cứ làm theo.',
      'Khi đơn giản hóa lại, mọi thứ gọn hơn và ít lỗi hơn hẳn.',
      'Sự phức tạp không phải dấu hiệu của sự tinh tế — thường là ngược lại.',
    ],
    [
      'Bỏ qua phần lập kế hoạch và bắt tay làm ngay vì "tưởng đơn giản".',
      'Đến giữa chừng mới phát hiện thiếu thông tin quan trọng, phải làm lại từ đầu.',
      'Dành 10 phút lập kế hoạch có thể tiết kiệm vài giờ làm lại.',
    ],
    [
      'Một thói quen nhỏ — đọc 10 trang sách mỗi tối — đã duy trì được 3 tuần.',
      'Không cần áp lực lớn, chỉ cần đủ nhỏ để không có lý do từ chối.',
      'Thay đổi bền vững đến từ hành động nhỏ lặp đi lặp lại, không phải nỗ lực bùng nổ.',
    ],
    [
      'Cảm thấy mệt mỏi và khó tập trung suốt cả buổi chiều.',
      'Nhớ lại mình đã bỏ bữa trưa và ngủ ít hơn bình thường tối qua.',
      'Hiệu suất tinh thần phụ thuộc trực tiếp vào nền tảng thể chất — ăn, ngủ, nghỉ.',
    ],
    [
      'Viết ra toàn bộ vấn đề đang loay hoay thay vì chỉ nghĩ trong đầu.',
      'Ngay khi viết xong, giải pháp bắt đầu hiện ra rõ hơn hẳn.',
      'Đưa vấn đề ra khỏi đầu và vào giấy giúp não nhìn thấy nó khách quan hơn.',
    ],
    [
      'Nhờ một người tin tưởng đảm nhận phần việc mình hay ôm một mình.',
      'Kết quả không những tốt mà còn giúp họ phát triển thêm kỹ năng.',
      'Giao việc và tin tưởng không phải bỏ trách nhiệm — đó là nhân lên sức mạnh.',
    ],
  ];

  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await db.execute(
      'INSERT INTO journal_entries (date, type, items) VALUES ($1, $2, $3)',
      [dateStr, 'gratitude', JSON.stringify(GRATITUDE_POOL[i - 1])]
    );
    await db.execute(
      'INSERT INTO journal_entries (date, type, items) VALUES ($1, $2, $3)',
      [dateStr, 'lesson', JSON.stringify(LESSON_POOL[i - 1])]
    );
  }
}
