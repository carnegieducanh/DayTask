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

  const LESSON_POOL: [string, string, string, string][] = [
    [
      'Mình đang kiệt sức vì công việc.',
      'Mình không biết từ chối, luôn muốn làm hài lòng tất cả mọi người và quản lý thời gian chưa tốt.',
      'Mình muốn làm việc hiệu quả nhưng vẫn còn thời gian nghỉ ngơi, không còn cảm giác kiệt sức mỗi ngày.',
      'Mình cần sắp xếp lại lịch làm việc, học cách ưu tiên, bớt ôm đồm và nghỉ ngơi đúng lúc.',
    ],
    [
      'Mình hay trì hoãn những việc quan trọng đến sát deadline mới làm.',
      'Mình sợ làm không tốt nên né tránh bắt đầu, và dễ bị phân tâm bởi việc nhỏ ít áp lực hơn.',
      'Mình muốn bắt tay vào việc quan trọng ngay khi có thể, không còn chạy đua với thời gian.',
      'Mình cần chia nhỏ việc lớn thành từng bước cụ thể và bắt đầu bằng bước nhỏ nhất trong 5 phút.',
    ],
    [
      'Mình dễ mất bình tĩnh khi bị góp ý về công việc.',
      'Mình gắn giá trị bản thân với kết quả công việc nên mọi lời phê bình đều cảm thấy như bị phủ nhận.',
      'Mình muốn đón nhận góp ý một cách bình tĩnh và xem đó là cơ hội để cải thiện.',
      'Mình cần tách bạch giữa việc làm chưa tốt và con người mình, và hỏi thêm chi tiết trước khi phản ứng.',
    ],
    [
      'Mình làm nhiều việc cùng lúc nhưng cuối ngày không việc nào xong trọn vẹn.',
      'Mình liên tục chuyển đổi giữa các việc vì sợ bỏ lỡ, khiến mỗi việc chỉ được làm nửa vời.',
      'Mình muốn tập trung sâu vào một việc tại một thời điểm và hoàn thành nó trước khi chuyển sang việc khác.',
      'Mình cần chặn thông báo, đặt khung thời gian cố định cho từng việc và chỉ làm một việc trong khung đó.',
    ],
    [
      'Mình thấy khó ra quyết định, kể cả những việc nhỏ.',
      'Mình luôn chờ đến khi có đủ thông tin hoàn hảo mới dám quyết, nhưng thông tin hoàn hảo không bao giờ đến.',
      'Mình muốn ra quyết định nhanh và dứt khoát hơn, chấp nhận rủi ro ở mức hợp lý.',
      'Mình cần đặt giới hạn thời gian cho mỗi quyết định và chấp nhận "đủ tốt" thay vì chờ hoàn hảo.',
    ],
    [
      'Mình quên mất những gì mình đã nghĩ khi viết code, giờ đọc lại không hiểu.',
      'Mình viết code cho bản thân lúc đang hiểu rõ ngữ cảnh, không nghĩ đến người đọc sau này — kể cả chính mình.',
      'Mình muốn code của mình dễ đọc lại, kể cả sau vài tháng không đụng tới.',
      'Mình cần viết comment cho lý do "tại sao", đặt tên biến rõ nghĩa và review lại trước khi commit.',
    ],
    [
      'Mình hay nhận giúp đỡ những việc không thuộc chuyên môn vì ngại từ chối.',
      'Mình sợ người khác thất vọng hoặc nghĩ mình không nhiệt tình.',
      'Mình muốn chỉ nhận những việc phù hợp với năng lực và thời gian của mình.',
      'Mình cần tập nói không một cách lịch sự, hoặc đề xuất người phù hợp hơn thay vì tự ôm việc.',
    ],
    [
      'Mình hay chọn giải pháp phức tạp dù việc đơn giản hơn vẫn giải quyết được vấn đề.',
      'Mình có xu hướng nghĩ giải pháp phức tạp mới chứng tỏ mình cố gắng và chuyên nghiệp.',
      'Mình muốn ưu tiên giải pháp đơn giản nhất có thể giải quyết được vấn đề.',
      'Mình cần tự hỏi "còn cách nào đơn giản hơn không" trước khi bắt tay triển khai.',
    ],
    [
      'Mình hay bắt tay làm ngay mà bỏ qua bước lên kế hoạch vì tưởng việc đơn giản.',
      'Mình đánh giá thấp độ phức tạp thực sự của công việc và ngại dành thời gian chuẩn bị.',
      'Mình muốn dành đủ thời gian lên kế hoạch trước khi bắt tay vào việc quan trọng.',
      'Mình cần dành ít nhất 10 phút viết ra các bước cần làm trước khi bắt đầu bất kỳ việc gì mới.',
    ],
    [
      'Mình muốn xây một thói quen đọc sách nhưng luôn bỏ giữa chừng sau vài ngày.',
      'Mình đặt mục tiêu quá lớn ngay từ đầu nên nhanh nản khi bận.',
      'Mình muốn duy trì thói quen đọc sách đều đặn, dù ít cũng được, trong thời gian dài.',
      'Mình cần hạ mục tiêu xuống mức tối thiểu — 10 trang mỗi ngày — để dễ duy trì hơn là dễ bỏ cuộc.',
    ],
    [
      'Mình thấy mệt mỏi, khó tập trung vào buổi chiều gần như mỗi ngày.',
      'Mình hay bỏ bữa trưa hoặc ăn vội, và ngủ không đủ giấc vào tối hôm trước.',
      'Mình muốn có năng lượng ổn định suốt cả ngày làm việc.',
      'Mình cần ăn trưa đúng giờ, đủ chất và đặt giờ ngủ cố định thay vì để cuốn theo công việc.',
    ],
    [
      'Mình hay giữ vấn đề trong đầu và loay hoay mãi không tìm ra hướng giải quyết.',
      'Mình chưa từng viết vấn đề ra giấy, chỉ nghĩ đi nghĩ lại trong đầu theo một vòng lặp.',
      'Mình muốn nhìn vấn đề rõ ràng hơn và tìm ra hướng đi nhanh hơn.',
      'Mình cần viết vấn đề ra giấy mỗi khi thấy bế tắc, thay vì chỉ nghĩ trong đầu.',
    ],
    [
      'Mình ôm hết mọi việc trong nhóm vì sợ giao cho người khác sẽ không đạt yêu cầu.',
      'Mình chưa thực sự tin tưởng đồng đội và cũng ngại mất thời gian hướng dẫn lại.',
      'Mình muốn giao việc được cho người khác mà vẫn yên tâm về chất lượng.',
      'Mình cần bắt đầu giao những việc nhỏ trước, hướng dẫn rõ kỳ vọng và tin tưởng cho họ tự làm.',
    ],
    [
      'Mình không hiểu rõ vấn đề kỹ thuật mình đang giải thích cho người khác.',
      'Mình chưa thực sự hiểu sâu, chỉ nắm bề mặt đủ để tự dùng chứ chưa đủ để dạy lại.',
      'Mình muốn hiểu vấn đề đủ sâu để có thể giải thích lại một cách đơn giản cho bất kỳ ai.',
      'Mình cần tự đặt câu hỏi "tại sao" nhiều lần với chính mình cho đến khi không còn lỗ hổng nào.',
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
