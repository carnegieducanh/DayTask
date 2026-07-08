import { isTauri } from './mockDb';
import type { Project, ProjectFolder, ProjectStatus, ProjectCategory, NewProject } from '../types';

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb() {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}

type Db = Awaited<ReturnType<typeof getDb>>;

type ProjectRow = {
  id: number;
  title: string;
  category: ProjectCategory;
  status: ProjectStatus;
  start_date: string | null;
  completed_date: string | null;
  notes: string | null;
  link_repo: string | null;
  link_youtube: string | null;
  composer: string | null;
  cover_image: string | null;
  created_at: string;
};

async function rowToProject(db: Db, row: ProjectRow): Promise<Project> {
  const folderRows = await db.select<{ name: string }[]>(
    `SELECT f.name FROM project_folders f
     JOIN project_folder_links l ON l.folder_id = f.id
     WHERE l.project_id = $1 ORDER BY f.name`,
    [row.id]
  );
  return { ...row, folders: folderRows.map((f) => f.name) };
}

async function linkFolders(db: Db, projectId: number, category: ProjectCategory, folders: string[]): Promise<void> {
  for (const name of folders) {
    const n = name.trim();
    if (!n) continue;
    await db.execute('INSERT OR IGNORE INTO project_folders (name, category) VALUES ($1, $2)', [n, category]);
    const rows = await db.select<{ id: number }[]>(
      'SELECT id FROM project_folders WHERE name = $1 AND category = $2',
      [n, category]
    );
    if (rows.length) {
      await db.execute(
        'INSERT OR IGNORE INTO project_folder_links (project_id, folder_id) VALUES ($1, $2)',
        [projectId, rows[0].id]
      );
    }
  }
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function dbGetProjects(opts: {
  category: ProjectCategory;
  folder?: string;
  status?: ProjectStatus;
  year?: number;
  search?: string;
}): Promise<Project[]> {
  if (!isTauri()) return [];
  const db = await getDb();

  const conditions: string[] = ['p.category = $1'];
  const params: unknown[] = [opts.category];
  let idx = 2;

  if (opts.status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(opts.status);
  }
  if (opts.year) {
    conditions.push(`CAST(strftime('%Y', COALESCE(p.completed_date, p.start_date, p.created_at)) AS INTEGER) = $${idx++}`);
    params.push(opts.year);
  }
  if (opts.folder) {
    conditions.push(
      `p.id IN (SELECT l.project_id FROM project_folder_links l JOIN project_folders f ON f.id = l.folder_id WHERE f.name = $${idx++} AND f.category = $${idx++})`
    );
    params.push(opts.folder, opts.category);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await db.select<ProjectRow[]>(
    `SELECT p.* FROM projects p ${where}
     ORDER BY COALESCE(p.completed_date, p.start_date, p.created_at) DESC`,
    params
  );
  const projects = await Promise.all(rows.map((r) => rowToProject(db, r)));

  const search = opts.search?.trim().toLowerCase();
  if (!search) return projects;
  return projects.filter((p) => p.title.toLowerCase().includes(search));
}

export async function dbAddProject(data: NewProject): Promise<Project | null> {
  if (!isTauri()) return null;
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO projects (title, category, status, start_date, completed_date, notes, link_repo, link_youtube, composer, cover_image)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      data.title,
      data.category,
      data.status,
      data.start_date || null,
      data.completed_date || null,
      data.notes || null,
      data.link_repo || null,
      data.link_youtube || null,
      data.composer || null,
      data.cover_image || null,
    ]
  );
  const id = result.lastInsertId as number;
  await linkFolders(db, id, data.category, data.folders);
  const rows = await db.select<ProjectRow[]>('SELECT * FROM projects WHERE id = $1', [id]);
  return rows.length ? rowToProject(db, rows[0]) : null;
}

export async function dbUpdateProject(id: number, data: NewProject): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute(
    `UPDATE projects SET title = $1, category = $2, status = $3, start_date = $4, completed_date = $5,
     notes = $6, link_repo = $7, link_youtube = $8, composer = $9, cover_image = $10 WHERE id = $11`,
    [
      data.title,
      data.category,
      data.status,
      data.start_date || null,
      data.completed_date || null,
      data.notes || null,
      data.link_repo || null,
      data.link_youtube || null,
      data.composer || null,
      data.cover_image || null,
      id,
    ]
  );
  await db.execute('DELETE FROM project_folder_links WHERE project_id = $1', [id]);
  await linkFolders(db, id, data.category, data.folders);
}

export async function dbDeleteProject(id: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM project_folder_links WHERE project_id = $1', [id]);
  await db.execute('DELETE FROM projects WHERE id = $1', [id]);
}

export async function dbGetProjectStats(
  category: ProjectCategory,
  year?: number
): Promise<{ total: number; inProgress: number; completed: number }> {
  if (!isTauri()) return { total: 0, inProgress: 0, completed: 0 };
  const db = await getDb();
  const conditions = ['category = $1'];
  const params: unknown[] = [category];
  if (year) {
    conditions.push(`CAST(strftime('%Y', COALESCE(completed_date, start_date, created_at)) AS INTEGER) = $2`);
    params.push(year);
  }
  const rows = await db.select<{ total: number; inProgress: number; completed: number }[]>(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM projects WHERE ${conditions.join(' AND ')}`,
    params
  );
  return {
    total: rows[0]?.total ?? 0,
    inProgress: rows[0]?.inProgress ?? 0,
    completed: rows[0]?.completed ?? 0,
  };
}

export async function dbGetYearsWithCounts(
  category: ProjectCategory,
  status?: ProjectStatus
): Promise<{ year: number; count: number }[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  const conditions = ['category = $1'];
  const params: unknown[] = [category];
  if (status) {
    conditions.push('status = $2');
    params.push(status);
  }
  return db.select<{ year: number; count: number }[]>(
    `SELECT CAST(strftime('%Y', COALESCE(completed_date, start_date, created_at)) AS INTEGER) as year, COUNT(*) as count
     FROM projects
     WHERE ${conditions.join(' AND ')}
     GROUP BY year
     ORDER BY year DESC`,
    params
  );
}

// ── Folders ──────────────────────────────────────────────────────────────────

type FolderRow = {
  id: number;
  name: string;
  category: ProjectCategory;
  cover_image: string | null;
  created_at: string;
  project_count: number;
  last_activity: string | null;
};

export async function dbGetFolders(opts: {
  category: ProjectCategory;
  status?: ProjectStatus;
  year?: number;
}): Promise<ProjectFolder[]> {
  if (!isTauri()) return [];
  const db = await getDb();

  const conditions: string[] = ['p.id IS NOT NULL'];
  const params: unknown[] = [];
  let idx = 1;
  if (opts.status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(opts.status);
  }
  if (opts.year) {
    conditions.push(`CAST(strftime('%Y', COALESCE(p.completed_date, p.start_date, p.created_at)) AS INTEGER) = $${idx++}`);
    params.push(opts.year);
  }
  const filterExpr = conditions.join(' AND ');

  const categoryParamIdx = idx;
  params.push(opts.category);

  return db.select<FolderRow[]>(
    `SELECT f.id, f.name, f.category, f.cover_image, f.created_at,
       COUNT(CASE WHEN ${filterExpr} THEN 1 END) as project_count,
       MAX(CASE WHEN ${filterExpr} THEN COALESCE(p.completed_date, p.start_date, p.created_at) END) as last_activity
     FROM project_folders f
     LEFT JOIN project_folder_links l ON l.folder_id = f.id
     LEFT JOIN projects p ON p.id = l.project_id
     WHERE f.category = $${categoryParamIdx}
     GROUP BY f.id
     ORDER BY (last_activity IS NULL), last_activity DESC, f.name ASC`,
    params
  );
}

export async function dbGetAllFolderNames(category: ProjectCategory): Promise<string[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  const rows = await db.select<{ name: string }[]>(
    'SELECT name FROM project_folders WHERE category = $1 ORDER BY name',
    [category]
  );
  return rows.map((r) => r.name);
}

export async function dbCreateFolderTag(name: string, category: ProjectCategory): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('INSERT OR IGNORE INTO project_folders (name, category) VALUES ($1, $2)', [name, category]);
}

export async function dbAddFolder(name: string, coverImage: string | null, category: ProjectCategory): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute(
    `INSERT INTO project_folders (name, category, cover_image) VALUES ($1, $2, $3)
     ON CONFLICT(name, category) DO UPDATE SET cover_image = excluded.cover_image`,
    [name, category, coverImage]
  );
}

export async function dbUpdateFolder(id: number, name: string, coverImage: string | null): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('UPDATE project_folders SET name = $1, cover_image = $2 WHERE id = $3', [name, coverImage, id]);
}

export async function dbDeleteFolder(id: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM project_folder_links WHERE folder_id = $1', [id]);
  await db.execute('DELETE FROM project_folders WHERE id = $1', [id]);
}

export async function dbRenameFolderName(oldName: string, newName: string, category: ProjectCategory): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute(
    'UPDATE project_folders SET name = $1 WHERE name = $2 AND category = $3',
    [newName, oldName, category]
  );
}

export async function dbDeleteFolderByName(name: string, category: ProjectCategory): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM project_folders WHERE name = $1 AND category = $2',
    [name, category]
  );
  if (rows.length) await dbDeleteFolder(rows[0].id);
}

// ── Dev seed data ──────────────────────────────────────────────────────────

function coverPlaceholder(hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex}"/><stop offset="1" stop-color="${hex}" stop-opacity="0.55"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const PRODUCT_FOLDER_SEED: { name: string; color: string }[] = [
  { name: 'HTML/CSS', color: '#F4511E' },
  { name: 'JavaScript', color: '#F6BF26' },
  { name: 'TypeScript', color: '#3F51B5' },
  { name: 'React', color: '#039BE5' },
  { name: 'Next.js', color: '#546E7A' },
  { name: 'Node.js', color: '#33B679' },
  { name: 'Tailwind CSS', color: '#4DB6AC' },
];

const FIGMA_FOLDER_SEED: { name: string; color: string }[] = [
  { name: 'UI Design', color: '#8E24AA' },
  { name: 'Branding', color: '#F6BF26' },
  { name: 'Mobile App', color: '#039BE5' },
];

const PIANO_FOLDER_SEED: { name: string; color: string }[] = [
  { name: 'Cổ điển', color: '#546E7A' },
  { name: 'Pop/Ballad', color: '#E67C73' },
  { name: 'Nhạc phim', color: '#33B679' },
];

const SEED_PROJECT_COVER_COLORS = [
  '#E67C73', '#F4511E', '#33B679', '#0B8043', '#039BE5',
  '#3F51B5', '#8E24AA', '#AB47BC', '#546E7A', '#4DB6AC',
];

export async function seedProjectsIfEmpty(): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM projects');
  if (rows[0].c > 0) return;

  for (const f of PRODUCT_FOLDER_SEED) await dbAddFolder(f.name, coverPlaceholder(f.color), 'product');
  for (const f of FIGMA_FOLDER_SEED) await dbAddFolder(f.name, coverPlaceholder(f.color), 'figma');
  for (const f of PIANO_FOLDER_SEED) await dbAddFolder(f.name, coverPlaceholder(f.color), 'piano');

  const productSeed: NewProject[] = [
    { title: 'Clone giao diện Shopee', category: 'product', status: 'completed', start_date: '2023-02-01', completed_date: '2023-02-20', folders: ['HTML/CSS', 'JavaScript'], notes: 'Luyện layout responsive và flexbox/grid.', link_repo: 'https://github.com/carnegieducanh/shopee-clone' },
    { title: 'Todo List App', category: 'product', status: 'completed', start_date: '2023-03-10', completed_date: '2023-03-15', folders: ['JavaScript'], notes: 'DOM manipulation cơ bản, lưu localStorage.', link_repo: 'https://github.com/carnegieducanh/todo-app' },
    { title: 'Landing Page cá nhân', category: 'product', status: 'completed', start_date: '2023-05-05', completed_date: '2023-05-12', folders: ['HTML/CSS', 'Tailwind CSS'], notes: 'Trang giới thiệu bản thân, học Tailwind lần đầu.' },
    { title: 'Quiz App trắc nghiệm', category: 'product', status: 'completed', start_date: '2023-08-01', completed_date: '2023-08-14', folders: ['JavaScript'], notes: 'Fetch API, xử lý state bằng tay không framework.' },
    { title: 'Weather App', category: 'product', status: 'completed', start_date: '2023-10-02', completed_date: '2023-10-09', folders: ['JavaScript'], notes: 'Gọi API thời tiết, xử lý async/await.', link_repo: 'https://github.com/carnegieducanh/weather-app' },
    { title: 'Blog cá nhân', category: 'product', status: 'completed', start_date: '2024-01-15', completed_date: '2024-02-05', folders: ['React'], notes: 'Lần đầu học React, component + props + state.' },
    { title: 'E-commerce UI Clone', category: 'product', status: 'completed', start_date: '2024-03-01', completed_date: '2024-03-25', folders: ['React', 'Tailwind CSS'], notes: 'Luyện component tái sử dụng và routing.', link_repo: 'https://github.com/carnegieducanh/ecommerce-ui' },
    { title: 'Pomodoro Timer', category: 'product', status: 'completed', start_date: '2024-05-10', completed_date: '2024-05-18', folders: ['React'], notes: 'useEffect, useState, custom hook đầu tiên.' },
    { title: 'Dashboard Admin', category: 'product', status: 'completed', start_date: '2024-07-01', completed_date: '2024-08-02', folders: ['React', 'TypeScript'], notes: 'Chuyển từ JS sang TS, học generic + interface.', link_repo: 'https://github.com/carnegieducanh/admin-dashboard' },
    { title: 'API Blog RESTful', category: 'product', status: 'completed', start_date: '2024-09-05', completed_date: '2024-09-28', folders: ['Node.js'], notes: 'Express + middleware + CRUD API.' },
    { title: 'Chat App Realtime', category: 'product', status: 'completed', start_date: '2024-11-01', completed_date: '2024-12-10', folders: ['Node.js', 'React'], notes: 'Socket.io, học realtime communication.', link_repo: 'https://github.com/carnegieducanh/realtime-chat', link_youtube: 'https://youtube.com/watch?v=demo-chat' },
    { title: 'Portfolio v2', category: 'product', status: 'completed', start_date: '2025-01-10', completed_date: '2025-01-25', folders: ['Next.js', 'Tailwind CSS'], notes: 'SSR/SSG với Next.js, tối ưu SEO.' },
    { title: 'Kanban Board kéo thả', category: 'product', status: 'completed', start_date: '2025-03-01', completed_date: '2025-03-20', folders: ['React', 'TypeScript'], notes: 'Học @dnd-kit, drag and drop nâng cao.' },
    { title: 'E-commerce Full Stack', category: 'product', status: 'completed', start_date: '2025-05-05', completed_date: '2025-07-15', folders: ['Next.js', 'Node.js', 'TypeScript'], notes: 'Dự án lớn nhất từ trước tới giờ: auth, thanh toán, quản lý đơn hàng.', link_repo: 'https://github.com/carnegieducanh/fullstack-ecommerce', link_youtube: 'https://youtube.com/watch?v=demo-ecommerce' },
    { title: 'Blog CMS cá nhân', category: 'product', status: 'completed', start_date: '2025-09-01', completed_date: '2025-09-30', folders: ['Next.js', 'Node.js'], notes: 'Tự viết CMS đơn giản để đăng bài blog.' },
    { title: 'Atomic — App quản lý task', category: 'product', status: 'in_progress', start_date: '2025-11-01', folders: ['React', 'TypeScript'], notes: 'Desktop app quản lý task hàng ngày bằng Tauri + React.', link_repo: 'https://github.com/carnegieducanh/DayTask' },
    { title: 'Học Server Components', category: 'product', status: 'in_progress', start_date: '2026-04-01', folders: ['Next.js'], notes: 'Đang tìm hiểu App Router và React Server Components.' },
    { title: 'Component Library nội bộ', category: 'product', status: 'in_progress', start_date: '2026-06-10', folders: ['React', 'TypeScript', 'Tailwind CSS'], notes: 'Xây bộ UI component tái sử dụng cho các dự án sau.' },
  ];

  const figmaSeed: NewProject[] = [
    { title: 'Redesign App Quản lý chi tiêu', category: 'figma', status: 'completed', start_date: '2025-02-01', completed_date: '2025-02-20', folders: ['UI Design', 'Mobile App'], notes: 'Thiết kế lại toàn bộ luồng nhập chi tiêu, tối giản số bước thao tác.', link_repo: 'https://figma.com/file/expense-app-redesign' },
    { title: 'Bộ nhận diện thương hiệu cá nhân', category: 'figma', status: 'completed', start_date: '2025-04-10', completed_date: '2025-04-25', folders: ['Branding'], notes: 'Logo, bảng màu, typography cho portfolio cá nhân.' },
    { title: 'Landing Page SaaS mẫu', category: 'figma', status: 'completed', start_date: '2025-07-01', completed_date: '2025-07-15', folders: ['UI Design'], notes: 'Luyện tập layout landing page kiểu SaaS hiện đại.', link_repo: 'https://figma.com/file/saas-landing', link_youtube: 'https://youtube.com/watch?v=demo-saas-landing' },
    { title: 'Mobile Banking App Concept', category: 'figma', status: 'in_progress', start_date: '2026-05-01', folders: ['UI Design', 'Mobile App'], notes: 'Đang thiết kế luồng chuyển khoản và quản lý thẻ.', link_repo: 'https://figma.com/file/banking-concept' },
  ];

  const pianoSeed: NewProject[] = [
    { title: 'River Flows in You', category: 'piano', status: 'completed', start_date: '2024-06-01', completed_date: '2024-06-20', composer: 'Yiruma', folders: ['Pop/Ballad'], notes: 'Bản nhạc đầu tiên tập hoàn chỉnh cả 2 tay.', link_youtube: 'https://youtube.com/watch?v=demo-river-flows' },
    { title: 'Für Elise', category: 'piano', status: 'completed', start_date: '2024-09-01', completed_date: '2024-10-05', composer: 'Beethoven', folders: ['Cổ điển'], notes: 'Đoạn A đã thuộc, đang luyện đoạn B nhanh hơn.' },
    { title: 'Merry-Go-Round of Life', category: 'piano', status: 'in_progress', start_date: '2026-03-01', composer: 'Joe Hisaishi', folders: ['Nhạc phim'], notes: 'Đang tập tay trái, nhịp 3/4 còn hơi vấp.', link_repo: 'https://musescore.com/scores/merry-go-round' },
    { title: 'Clair de Lune', category: 'piano', status: 'in_progress', start_date: '2026-06-15', composer: 'Debussy', folders: ['Cổ điển'], notes: 'Mới học 2 trang đầu, cần luyện pedal.' },
  ];

  const allSeed = [...productSeed, ...figmaSeed, ...pianoSeed];
  for (let i = 0; i < allSeed.length; i++) {
    await dbAddProject({ ...allSeed[i], cover_image: coverPlaceholder(SEED_PROJECT_COVER_COLORS[i % SEED_PROJECT_COVER_COLORS.length]) });
  }
}
