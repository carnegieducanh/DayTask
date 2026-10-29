import { format, addMonths, addYears, subMonths, subYears } from 'date-fns';
import { isTauri } from './mockDb';
import { getDb } from './db';
import type { Vision, NewVision, VisionAim, NewVisionAim, VisionAimLog, AimItem, AimStatus } from '../types';

// Tab Tầm nhìn — không dùng Zustand, VisionView tự giữ state local (giống Books/Quotes).
// Data rất nhỏ (vài cột mốc, vài chục mục tiêu) nên view load toàn bộ 1 lần thay vì filter theo cột mốc.

type AimRow = Omit<VisionAim, 'items'> & { items: string };

function rowToAim(row: AimRow): VisionAim {
  let items: AimItem[] = [];
  try {
    const parsed = JSON.parse(row.items);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    // giữ [] nếu JSON hỏng
  }
  return { ...row, items };
}

// ── Dữ liệu giả để test (chỉ dev) ──
// Dựng từ kế hoạch thật của user ("Năm 35 tuổi — 2 năm nữa"), ngày tháng tính tương đối theo hôm nay
// để thanh thời gian/đếm ngược luôn có ý nghĩa. Điểm thi, số dư, ngày thi là số giả.
// Thêm "Năm 40 tuổi" (rỗng, test empty state) và "Năm 30 tuổi" (đã qua hạn, test mục "Đã đi qua" + con dấu).

type SeedLog = { date: string; value: number; note: string | null };
type SeedAim = Omit<NewVisionAim, 'vision_id'> & { achieved_date: string | null; logs: SeedLog[] };
type SeedVision = NewVision & { reviewed_at: string | null; aims: SeedAim[] };

function buildSeed(): SeedVision[] {
  const now = new Date();
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  const ym = (d: Date) => format(d, 'yyyy-MM');
  const ago = (months: number) => iso(subMonths(now, months));
  const ahead = (months: number) => ym(addMonths(now, months));
  const t35 = addYears(now, 2);
  const t30 = subYears(now, 3);

  const aim = (a: Partial<SeedAim> & Pick<SeedAim, 'title' | 'category' | 'kind'>): SeedAim => ({
    preset: null, scale_min: null, scale_max: null, target_value: null, unit: null, items: [],
    status: 'in_progress', achieved_date: null, next_step: null, next_date: null, logs: [], ...a,
  });
  const passed = (name: string, done: boolean, parts: [string, boolean][]): AimItem => ({
    name, done, parts: parts.map(([n, d]) => ({ name: n, done: d })),
  });

  return [
    {
      title: 'Năm 30 tuổi',
      target_date: iso(t30),
      start_date: iso(subYears(t30, 2)),
      motto: null,
      reviewed_at: iso(subMonths(t30, 1)),
      aims: [
        aim({ title: 'JLPT N2', category: 'learn', kind: 'checklist', status: 'achieved', achieved_date: iso(subMonths(t30, 10)) }),
        aim({
          title: 'Tiết kiệm 100万円', category: 'finance', kind: 'amount', target_value: 100, unit: '万円',
          status: 'achieved', achieved_date: iso(subMonths(t30, 4)),
          logs: [
            { date: iso(subMonths(t30, 20)), value: 40, note: null },
            { date: iso(subMonths(t30, 12)), value: 72, note: null },
            { date: iso(subMonths(t30, 4)), value: 100, note: null },
          ],
        }),
        aim({ title: 'Chạy trọn một giải half marathon', category: 'health', kind: 'checklist' }),
      ],
    },
    {
      title: 'Năm 35 tuổi',
      target_date: iso(t35),
      start_date: ago(10),
      motto: 'Đủ năng lực để chọn việc mình muốn làm, và đủ vốn để không phải vội.',
      reviewed_at: ago(4),
      aims: [
        aim({
          title: 'TOEIC 900+', category: 'learn', kind: 'score', preset: 'toeic', scale_min: 10, scale_max: 990, target_value: 900,
          next_step: 'Thi lại', next_date: ahead(3),
          logs: [
            { date: ago(19), value: 705, note: 'L 380 · R 325' },
            { date: ago(11), value: 760, note: 'L 405 · R 355' },
            { date: ago(4), value: 815, note: 'L 430 · R 385' },
          ],
        }),
        aim({
          title: 'BJT J1+ (≥ 600)', category: 'learn', kind: 'score', preset: 'bjt', scale_min: 0, scale_max: 800, target_value: 600,
          next_step: 'Thi BJT lần 2', next_date: ahead(5),
          logs: [{ date: ago(7), value: 548, note: null }],
        }),
        aim({
          title: 'ウェブデザイン技能検定 2級', category: 'learn', kind: 'level', target_value: 1,
          next_step: 'Thi lại phần 実技', next_date: ahead(4),
          items: [
            passed('3級', true, [['学科', true], ['実技', true]]),
            passed('2級', false, [['学科', true], ['実技', false]]),
            passed('1級', false, [['学科', false], ['実技', false]]),
          ],
        }),
        aim({
          title: 'Google UX Design Professional Certificate', category: 'learn', kind: 'checklist',
          items: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `Khóa ${n}`, done: n <= 3, parts: [] })),
        }),
        aim({
          title: 'Tài khoản tiết kiệm 500万円', category: 'finance', kind: 'amount', target_value: 500, unit: '万円',
          logs: [
            { date: ago(9), value: 140, note: null },
            { date: ago(5), value: 175, note: null },
            { date: ago(1), value: 210, note: null },
          ],
        }),
        aim({ title: 'Có khoản đầu tư', category: 'finance', kind: 'checklist', status: 'not_started' }),
      ],
    },
    {
      title: 'Năm 40 tuổi',
      target_date: iso(addYears(t35, 5)),
      start_date: iso(now),
      motto: null,
      reviewed_at: null,
      aims: [],
    },
  ];
}

// Tauri dev (`npm run tauri dev`): ghi dữ liệu giả vào SQLite thật nếu bảng visions đang trống.
// Không chạy ở bản build release. Promise dùng chung để StrictMode (effect chạy 2 lần) không seed trùng.
// Bản dev và bản cài dùng CHUNG file atomic.db (cùng identifier) → chỉ seed 1 lần (cờ localStorage),
// để xóa hết dữ liệu giả xong thì không bị chèn lại.
const DEV_SEEDED_KEY = 'visionDevSeeded';
let devSeeding: Promise<void> | null = null;

export function seedVisionDevData(): Promise<void> {
  if (!isTauri() || !import.meta.env.DEV) return Promise.resolve();
  try {
    if (localStorage.getItem(DEV_SEEDED_KEY)) return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
  devSeeding ??= (async () => {
    const db = await getDb();
    const rows = await db.select<{ c: number }[]>('SELECT COUNT(*) AS c FROM visions');
    try {
      localStorage.setItem(DEV_SEEDED_KEY, '1');
    } catch {
      // bỏ qua
    }
    if (rows[0].c > 0) return;
    for (const v of buildSeed()) {
      const vRes = await db.execute(
        'INSERT INTO visions (title, target_date, start_date, motto, reviewed_at) VALUES ($1, $2, $3, $4, $5)',
        [v.title, v.target_date, v.start_date, v.motto ?? null, v.reviewed_at]
      );
      const visionId = vRes.lastInsertId as number;
      for (const [position, a] of v.aims.entries()) {
        const aRes = await db.execute(
          `INSERT INTO vision_aims (vision_id, title, category, kind, preset, scale_min, scale_max, target_value, unit, items, status, achieved_date, next_step, next_date, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [visionId, a.title, a.category, a.kind, a.preset, a.scale_min, a.scale_max, a.target_value, a.unit,
           JSON.stringify(a.items), a.status, a.achieved_date, a.next_step, a.next_date, position]
        );
        const aimId = aRes.lastInsertId as number;
        for (const l of a.logs) {
          await db.execute(
            'INSERT INTO vision_aim_logs (aim_id, date, value, note) VALUES ($1, $2, $3, $4)',
            [aimId, l.date, l.value, l.note]
          );
        }
      }
    }
  })();
  return devSeeding;
}

// ── Browser dev mode (npm run dev, không có SQLite): cùng dữ liệu giả, giữ trong bộ nhớ ──

let mockVisions: Vision[] = [];
let mockAims: VisionAim[] = [];
let mockLogs: VisionAimLog[] = [];
let mockNextId = 1;

function seedMock() {
  if (mockVisions.length) return;
  for (const v of buildSeed()) {
    const visionId = mockNextId++;
    mockVisions.push({ id: visionId, title: v.title, target_date: v.target_date, start_date: v.start_date, motto: v.motto ?? null, reviewed_at: v.reviewed_at, created_at: '' });
    v.aims.forEach(({ logs, ...a }, position) => {
      const aimId = mockNextId++;
      mockAims.push({ ...a, id: aimId, vision_id: visionId, position, created_at: '' });
      for (const l of logs) mockLogs.push({ id: mockNextId++, aim_id: aimId, ...l });
    });
  }
}

// ── Visions ──

export async function dbGetVisions(): Promise<Vision[]> {
  if (!isTauri()) {
    seedMock();
    return [...mockVisions].sort((a, b) => a.target_date.localeCompare(b.target_date));
  }
  const db = await getDb();
  return db.select<Vision[]>('SELECT * FROM visions ORDER BY target_date ASC, id ASC');
}

export async function dbAddVision(v: NewVision): Promise<number> {
  if (!isTauri()) {
    const id = mockNextId++;
    mockVisions.push({ id, title: v.title, target_date: v.target_date, start_date: v.start_date, motto: v.motto ?? null, reviewed_at: null, created_at: '' });
    return id;
  }
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO visions (title, target_date, start_date, motto) VALUES ($1, $2, $3, $4)',
    [v.title, v.target_date, v.start_date, v.motto || null]
  );
  return result.lastInsertId as number;
}

export async function dbUpdateVision(id: number, v: NewVision): Promise<void> {
  if (!isTauri()) {
    mockVisions = mockVisions.map((x) => (x.id === id ? { ...x, title: v.title, target_date: v.target_date, start_date: v.start_date, motto: v.motto ?? null } : x));
    return;
  }
  const db = await getDb();
  await db.execute(
    'UPDATE visions SET title = $1, target_date = $2, start_date = $3, motto = $4 WHERE id = $5',
    [v.title, v.target_date, v.start_date, v.motto || null, id]
  );
}

export async function dbMarkVisionReviewed(id: number, date: string): Promise<void> {
  if (!isTauri()) {
    mockVisions = mockVisions.map((x) => (x.id === id ? { ...x, reviewed_at: date } : x));
    return;
  }
  const db = await getDb();
  await db.execute('UPDATE visions SET reviewed_at = $1 WHERE id = $2', [date, id]);
}

export async function dbDeleteVision(id: number): Promise<void> {
  if (!isTauri()) {
    const aimIds = new Set(mockAims.filter((a) => a.vision_id === id).map((a) => a.id));
    mockLogs = mockLogs.filter((l) => !aimIds.has(l.aim_id));
    mockAims = mockAims.filter((a) => a.vision_id !== id);
    mockVisions = mockVisions.filter((v) => v.id !== id);
    return;
  }
  const db = await getDb();
  // Xóa tay con trước — không dựa vào ON DELETE CASCADE vì foreign_keys có thể đang tắt trên connection
  await db.execute('DELETE FROM vision_aim_logs WHERE aim_id IN (SELECT id FROM vision_aims WHERE vision_id = $1)', [id]);
  await db.execute('DELETE FROM vision_aims WHERE vision_id = $1', [id]);
  await db.execute('DELETE FROM visions WHERE id = $1', [id]);
}

// ── Aims ──

export async function dbGetAllAims(): Promise<VisionAim[]> {
  if (!isTauri()) {
    seedMock();
    return mockAims.map((a) => ({ ...a, items: a.items.map((it) => ({ ...it, parts: it.parts.map((p) => ({ ...p })) })) }));
  }
  const db = await getDb();
  const rows = await db.select<AimRow[]>('SELECT * FROM vision_aims ORDER BY vision_id ASC, position ASC, id ASC');
  return rows.map(rowToAim);
}

export async function dbAddAim(aim: NewVisionAim): Promise<number> {
  if (!isTauri()) {
    const id = mockNextId++;
    const position = mockAims.filter((a) => a.vision_id === aim.vision_id).length;
    mockAims.push({ ...aim, id, position, achieved_date: null, created_at: '' });
    return id;
  }
  const db = await getDb();
  const posRows = await db.select<{ p: number | null }[]>(
    'SELECT MAX(position) AS p FROM vision_aims WHERE vision_id = $1',
    [aim.vision_id]
  );
  const position = (posRows[0]?.p ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO vision_aims (vision_id, title, category, kind, preset, scale_min, scale_max, target_value, unit, items, status, next_step, next_date, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [aim.vision_id, aim.title, aim.category, aim.kind, aim.preset, aim.scale_min, aim.scale_max, aim.target_value,
     aim.unit, JSON.stringify(aim.items), aim.status, aim.next_step, aim.next_date, position]
  );
  return result.lastInsertId as number;
}

export async function dbUpdateAim(id: number, aim: NewVisionAim): Promise<void> {
  if (!isTauri()) {
    mockAims = mockAims.map((a) => (a.id === id ? { ...a, ...aim } : a));
    return;
  }
  const db = await getDb();
  await db.execute(
    `UPDATE vision_aims SET title = $1, category = $2, kind = $3, preset = $4, scale_min = $5, scale_max = $6,
       target_value = $7, unit = $8, items = $9, next_step = $10, next_date = $11
     WHERE id = $12`,
    [aim.title, aim.category, aim.kind, aim.preset, aim.scale_min, aim.scale_max, aim.target_value,
     aim.unit, JSON.stringify(aim.items), aim.next_step, aim.next_date, id]
  );
}

export async function dbSetAimStatus(id: number, status: AimStatus, achievedDate: string | null): Promise<void> {
  if (!isTauri()) {
    mockAims = mockAims.map((a) => (a.id === id ? { ...a, status, achieved_date: achievedDate } : a));
    return;
  }
  const db = await getDb();
  await db.execute('UPDATE vision_aims SET status = $1, achieved_date = $2 WHERE id = $3', [status, achievedDate, id]);
}

export async function dbSetAimItems(id: number, items: AimItem[]): Promise<void> {
  if (!isTauri()) {
    mockAims = mockAims.map((a) => (a.id === id ? { ...a, items } : a));
    return;
  }
  const db = await getDb();
  await db.execute('UPDATE vision_aims SET items = $1 WHERE id = $2', [JSON.stringify(items), id]);
}

export async function dbDeleteAim(id: number): Promise<void> {
  if (!isTauri()) {
    mockLogs = mockLogs.filter((l) => l.aim_id !== id);
    mockAims = mockAims.filter((a) => a.id !== id);
    return;
  }
  const db = await getDb();
  await db.execute('DELETE FROM vision_aim_logs WHERE aim_id = $1', [id]);
  await db.execute('DELETE FROM vision_aims WHERE id = $1', [id]);
}

// ── Logs (lần thi / số dư theo ngày) ──

export async function dbGetAllAimLogs(): Promise<VisionAimLog[]> {
  if (!isTauri()) {
    seedMock();
    return [...mockLogs];
  }
  const db = await getDb();
  return db.select<VisionAimLog[]>('SELECT id, aim_id, date, value, note FROM vision_aim_logs ORDER BY date ASC, id ASC');
}

export async function dbAddAimLog(aimId: number, date: string, value: number, note: string | null): Promise<void> {
  if (!isTauri()) {
    mockLogs.push({ id: mockNextId++, aim_id: aimId, date, value, note });
    return;
  }
  const db = await getDb();
  await db.execute(
    'INSERT INTO vision_aim_logs (aim_id, date, value, note) VALUES ($1, $2, $3, $4)',
    [aimId, date, value, note || null]
  );
}

export async function dbDeleteAimLog(id: number): Promise<void> {
  if (!isTauri()) {
    mockLogs = mockLogs.filter((l) => l.id !== id);
    return;
  }
  const db = await getDb();
  await db.execute('DELETE FROM vision_aim_logs WHERE id = $1', [id]);
}
