import type { StateCreator } from 'zustand';
import { format } from 'date-fns';
import type { Task, Goal, GoalChecklistItem, CategoryColors, Category, Tag, TaskTimeEntry, Quarter } from '../../types';
import {
  isTauri,
  mockTasks, mockGoals, mockChecklist, mockTags, mockTaskTags, mockTimeEntries,
  dbGetAllChecklistItems,
} from '../mockDb';
import { getDb } from '../db';
import { DEFAULT_CATEGORY_COLORS } from './taskSlice';
import { quartersToDb, quartersFromDb } from '../../utils/quarterUtils';
import type { AppState } from '../appStore';

type JournalEntryRow = { id: number; date: string; type: string; items: string; created_at: string; updated_at: string };
type WeeklyChecklistRow = { id: number; week_key: string; text: string; is_done: number; position: number; created_at: string };
type VocabWordRow = { id: number; word: string; ipa: string; meaning: string; meaning_en: string; part_of_speech: string; position: number; created_at: string };
type QuoteRow = { id: number; text: string; author: string | null; language: string; is_favorite: number; created_at: string };
type QuoteTagRow = { quote_id: number; tag: string };
type BookRow = { id: number; title: string; author: string | null; cover_image: string | null; status: string; started_date: string | null; finished_date: string | null; notes: string | null; created_at: string };
type BookTagRow = { book_id: number; tag: string };
type BookGoalRow = { year: number; goal: number };
type ProjectFolderRow = { id: number; name: string; category?: string; cover_image: string | null; created_at: string };
type ProjectRow = { id: number; title: string; category?: string; status: string; start_date: string | null; completed_date: string | null; notes: string | null; link_repo: string | null; link_youtube: string | null; composer?: string | null; cover_image: string | null; cover_image_thumb?: string | null; created_at: string };
type ProjectFolderLinkRow = { project_id: number; folder_id: number };

async function seedMockData(db: import('@tauri-apps/plugin-sql').default, today: string) {
  // Tasks hôm nay
  const tasks: Array<[string, string | null, string, string, number]> = [
    ['Họp team sprint planning', 'Discuss sprint goals and assign tickets', 'work', today, 0],
    ['Đọc sách 30 phút', 'Atomic Habits — chương 7', 'personal', today, 0],
    ['Tập thể dục buổi sáng', 'Chạy bộ 5km + stretch', 'health', today, 1],
    ['Review code pull request', 'PR #42 — refactor auth module', 'work', today, 1],
    ['Gửi báo cáo tuần', 'Tổng kết KPI tuần, gửi cho manager', 'work', today, 1],
  ];
  for (const t of tasks) {
    await db.execute(
      `INSERT INTO tasks (title, description, category, date, is_done) VALUES ($1,$2,$3,$4,$5)`,
      t
    );
  }
  // Seed time entries cho 2 task đầu
  const rows = await db.select<{ id: number; title: string }[]>(
    `SELECT id, title FROM tasks WHERE date = $1 ORDER BY created_at ASC LIMIT 5`,
    [today]
  );
  const timeMap: Record<string, [string, string]> = {
    'Họp team sprint planning': ['14:00', '15:30'],
    'Đọc sách 30 phút': ['21:00', '21:30'],
  };
  for (const row of rows) {
    const times = timeMap[row.title];
    if (times) {
      await db.execute(
        `INSERT INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)`,
        [row.id, today, times[0], times[1]]
      );
    }
  }

  // Heatmap: tasks hoàn thành 90 ngày qua
  const todayDate = new Date(today + 'T00:00:00');
  const heatPattern = [2,0,3,1,4,2,0,1,3,2,4,1,0,3,2,1,4,2,3,0,1,2,4,3,1,0,2,3,1,4,2,0,3,2,4,1,3,0,2,1,4,3,2,0,1,3,2,4,2,0,3,1,4,2,1,3,4,2,0,3,1,2,4,3,0,2,1,3,4,1,2,0,3,1,4,2,0,3,1,2,4,3,0,1,2,3,4,2,1,0];
  for (let i = 1; i <= 90; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = heatPattern[(i - 1) % heatPattern.length];
    for (let j = 0; j < count; j++) {
      await db.execute(
        `INSERT INTO tasks (title, category, date, is_done) VALUES ($1,$2,$3,1)`,
        [`Task ${j + 1}`, 'work', dateStr]
      );
    }
  }

  // Goals 2026
  const goals: Array<[string, string | null, string, string, number, string, string, number, number]> = [
    // [title, desc, category, priority, year, quarter, status, progress, position]
    ['Học tiếng Anh IELTS 7.0', 'Luyện thi 4 kỹ năng, thi thử mỗi tháng', 'learn', 'high', 2026, 'Q3', 'todo', 0, 0],
    ['Mua xe mới', 'Tiết kiệm đủ ngân sách, chọn model phù hợp', 'personal', 'mid', 2026, 'Q4', 'todo', 0, 1],
    ['Tham gia khóa thiền định', '10 ngày Vipassana', 'health', 'low', 2026, 'Q2', 'todo', 0, 2],
    ['Hoàn thiện portfolio cá nhân', 'Website giới thiệu dự án và kỹ năng', 'work', 'mid', 2026, 'Q2', 'todo', 0, 3],
    ['Tăng cân lên 70kg', 'Gym 4 buổi/tuần, chế độ dinh dưỡng', 'health', 'high', 2026, 'Q3', 'doing', 55, 0],
    ['Học Python & Data Science', 'Hoàn thành 3 khóa online, làm 2 project', 'learn', 'high', 2026, 'Q4', 'doing', 35, 1],
    ['Tiết kiệm 50 triệu', 'Đặt aside 5 triệu/tháng tự động', 'personal', 'mid', 2026, 'full', 'doing', 40, 2],
    ['Đọc 12 cuốn sách', 'Mỗi tháng 1 cuốn, ghi chú tóm tắt', 'personal', 'low', 2026, 'full', 'review', 75, 0],
    ['Ra mắt side project', 'App quản lý chi tiêu cá nhân', 'work', 'high', 2026, 'Q2', 'review', 85, 1],
    ['Lập kế hoạch tài chính năm', 'Ngân sách, đầu tư, quỹ khẩn cấp', 'personal', 'high', 2026, 'Q1', 'done', 100, 0],
    ['Khám sức khỏe định kỳ', 'Xét nghiệm tổng quát đầu năm', 'health', 'low', 2026, 'Q1', 'done', 100, 1],
    ['Setup môi trường làm việc', 'Màn hình, bàn phím cơ, microphone', 'work', 'low', 2026, 'Q1', 'done', 100, 2],
  ];
  for (const g of goals) {
    await db.execute(
      `INSERT INTO goals (title, description, category, priority, year, quarters, status, progress, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      g
    );
  }
}

export interface DataSlice {
  seedIfEmpty: () => Promise<void>;
  exportAllData: () => Promise<void>;
  importAllData: (file: File) => Promise<void>;
  resetAllData: () => Promise<void>;
}

export const createDataSlice: StateCreator<AppState, [], [], DataSlice> = (_set, get) => ({
  seedIfEmpty: async () => {
    if (!isTauri()) return; // mock data already in mockDb.ts
    const db = await getDb();
    const rows = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM tasks');
    if (rows[0].c > 0) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    await seedMockData(db, today);
    await get().loadTasks(get().selectedDate);
    await get().loadGoals(get().selectedYear);
  },

  // --- Export / Import toàn bộ dữ liệu ---

  exportAllData: async () => {
    let tasks: Task[];
    let goals: Goal[];
    let checklistItems: GoalChecklistItem[];
    let categoryColors: CategoryColors;
    let tags: Tag[];
    let taskTagPairs: Array<{ task_id: number; tag_id: number }>;
    let timeEntries: TaskTimeEntry[];
    let journalEntries: JournalEntryRow[];
    let weeklyChecklist: WeeklyChecklistRow[];
    let vocabWords: VocabWordRow[];
    let quotes: QuoteRow[];
    let quoteTags: QuoteTagRow[];
    let books: BookRow[];
    let bookTags: BookTagRow[];
    let bookReadingGoals: BookGoalRow[];
    let projectFolders: ProjectFolderRow[];
    let projects: ProjectRow[];
    let projectFolderLinks: ProjectFolderLinkRow[];

    if (!isTauri()) {
      tasks = [...mockTasks];
      goals = [...mockGoals];
      checklistItems = dbGetAllChecklistItems();
      const stored = localStorage.getItem('categoryColors');
      categoryColors = stored ? JSON.parse(stored) : { ...DEFAULT_CATEGORY_COLORS };
      tags = [...mockTags];
      taskTagPairs = Object.entries(mockTaskTags).flatMap(([taskId, tagIds]) =>
        tagIds.map((tagId) => ({ task_id: Number(taskId), tag_id: tagId }))
      );
      timeEntries = [...mockTimeEntries];
      // Journal/Vocab/Quotes/Books have no mock-mode store — nothing to export in browser dev mode.
      journalEntries = [];
      weeklyChecklist = [];
      vocabWords = [];
      quotes = [];
      quoteTags = [];
      books = [];
      bookTags = [];
      bookReadingGoals = [];
      projectFolders = [];
      projects = [];
      projectFolderLinks = [];
    } else {
      const db = await getDb();
      tasks = await db.select<Task[]>('SELECT * FROM tasks ORDER BY date ASC, created_at ASC');
      const goalRows = await db.select<Array<Omit<Goal, 'quarters'> & { quarters: string }>>(
        'SELECT * FROM goals ORDER BY year ASC, status ASC, position ASC'
      );
      goals = goalRows.map((row) => ({ ...row, quarters: quartersFromDb(row.quarters) }));
      checklistItems = await db.select<GoalChecklistItem[]>('SELECT * FROM goal_checklist_items ORDER BY goal_id, position ASC');
      const colorRows = await db.select<{ category: string; color: string }[]>('SELECT category, color FROM category_colors');
      categoryColors = { ...DEFAULT_CATEGORY_COLORS };
      for (const row of colorRows) {
        categoryColors[row.category as Category] = row.color;
      }
      tags = await db.select<Tag[]>('SELECT * FROM tags ORDER BY created_at ASC');
      taskTagPairs = await db.select<Array<{ task_id: number; tag_id: number }>>('SELECT task_id, tag_id FROM task_tags');
      timeEntries = await db.select<TaskTimeEntry[]>('SELECT * FROM task_time_entries ORDER BY task_id, date');
      journalEntries = await db.select<JournalEntryRow[]>('SELECT * FROM journal_entries ORDER BY id ASC');
      weeklyChecklist = await db.select<WeeklyChecklistRow[]>('SELECT * FROM weekly_checklist ORDER BY id ASC');
      vocabWords = await db.select<VocabWordRow[]>('SELECT * FROM vocab_words ORDER BY id ASC');
      quotes = await db.select<QuoteRow[]>('SELECT * FROM quotes ORDER BY id ASC');
      quoteTags = await db.select<QuoteTagRow[]>('SELECT quote_id, tag FROM quote_tags');
      books = await db.select<BookRow[]>('SELECT * FROM books ORDER BY id ASC');
      bookTags = await db.select<BookTagRow[]>('SELECT book_id, tag FROM book_tags');
      bookReadingGoals = await db.select<BookGoalRow[]>('SELECT year, goal FROM book_reading_goals ORDER BY year ASC');
      projectFolders = await db.select<ProjectFolderRow[]>('SELECT * FROM project_folders ORDER BY id ASC');
      projects = await db.select<ProjectRow[]>('SELECT * FROM projects ORDER BY id ASC');
      projectFolderLinks = await db.select<ProjectFolderLinkRow[]>('SELECT project_id, folder_id FROM project_folder_links');
    }

    const payload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      tasks, goals, checklistItems, categoryColors, tags, taskTags: taskTagPairs, timeEntries,
      journalEntries, weeklyChecklist, vocabWords, quotes, quoteTags, books, bookTags, bookReadingGoals,
      projectFolders, projects, projectFolderLinks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atomic-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importAllData: async (file: File) => {
    const text = await file.text();
    // `quarter` (singular) hỗ trợ đọc backup cũ trước khi Quarter deadline hỗ trợ multi-select.
    type ImportedGoal = Omit<Goal, 'quarters'> & { quarters?: Quarter[]; quarter?: Quarter };
    let data: {
      tasks?: Task[]; goals?: ImportedGoal[]; checklistItems?: GoalChecklistItem[]; categoryColors?: CategoryColors;
      tags?: Tag[]; taskTags?: Array<{ task_id: number; tag_id: number }>; timeEntries?: TaskTimeEntry[];
      journalEntries?: JournalEntryRow[]; weeklyChecklist?: WeeklyChecklistRow[]; vocabWords?: VocabWordRow[];
      quotes?: QuoteRow[]; quoteTags?: QuoteTagRow[];
      books?: BookRow[]; bookTags?: BookTagRow[]; bookReadingGoals?: BookGoalRow[];
      projectFolders?: ProjectFolderRow[]; projects?: ProjectRow[]; projectFolderLinks?: ProjectFolderLinkRow[];
    };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('File không hợp lệ — không thể đọc JSON');
    }
    if (!Array.isArray(data.tasks) || !Array.isArray(data.goals) || !Array.isArray(data.checklistItems)) {
      throw new Error('File không hợp lệ — thiếu trường tasks / goals / checklistItems');
    }

    if (!isTauri()) {
      mockTasks.length = 0;
      mockGoals.length = 0;
      mockChecklist.length = 0;
      mockTasks.push(...data.tasks);
      mockGoals.push(...data.goals.map((g) => ({ ...g, quarters: g.quarters ?? (g.quarter ? [g.quarter] : ['Q1' as Quarter]) })));
      mockChecklist.push(...data.checklistItems);
      if (data.categoryColors) {
        localStorage.setItem('categoryColors', JSON.stringify(data.categoryColors));
      }
      mockTags.length = 0;
      if (Array.isArray(data.tags)) mockTags.push(...data.tags);
      for (const k of Object.keys(mockTaskTags)) delete mockTaskTags[Number(k)];
      if (Array.isArray(data.taskTags)) {
        for (const tt of data.taskTags) {
          if (!mockTaskTags[tt.task_id]) mockTaskTags[tt.task_id] = [];
          mockTaskTags[tt.task_id].push(tt.tag_id);
        }
      }
      mockTimeEntries.length = 0;
      if (Array.isArray(data.timeEntries)) mockTimeEntries.push(...data.timeEntries);
    } else {
      const db = await getDb();
      await db.execute('DELETE FROM task_time_entries');
      await db.execute('DELETE FROM task_tags');
      await db.execute('DELETE FROM goal_checklist_items');
      await db.execute('DELETE FROM tasks');
      await db.execute('DELETE FROM goals');
      await db.execute('DELETE FROM category_colors');
      await db.execute('DELETE FROM tags');

      for (const t of data.tasks) {
        await db.execute(
          `INSERT INTO tasks (id, title, description, category, date, is_done, repeat_daily, series_id, repeat_end_date, created_at, color)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [t.id, t.title, t.description ?? null, t.category, t.date, t.is_done, t.repeat_daily ?? 0,
           t.series_id ?? null, t.repeat_end_date ?? null, t.created_at, t.color ?? null]
        );
      }
      for (const g of data.goals) {
        const quarters = g.quarters ?? (g.quarter ? [g.quarter] : ['Q1' as Quarter]);
        await db.execute(
          `INSERT INTO goals (id, title, description, category, priority, year, quarters, status, progress, position, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [g.id, g.title, g.description ?? null, g.category, g.priority, g.year, quartersToDb(quarters), g.status, g.progress, g.position, g.created_at]
        );
      }
      for (const ci of data.checklistItems) {
        await db.execute(
          `INSERT INTO goal_checklist_items (id, goal_id, text, is_done, position) VALUES ($1,$2,$3,$4,$5)`,
          [ci.id, ci.goal_id, ci.text, ci.is_done, ci.position]
        );
      }
      if (data.categoryColors) {
        for (const [cat, color] of Object.entries(data.categoryColors)) {
          await db.execute('INSERT OR REPLACE INTO category_colors (category, color) VALUES ($1, $2)', [cat, color]);
        }
      }
      if (Array.isArray(data.tags)) {
        for (const tag of data.tags) {
          await db.execute(
            'INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)',
            [tag.id, tag.name, tag.color, tag.created_at]
          );
        }
      }
      if (Array.isArray(data.taskTags)) {
        for (const tt of data.taskTags) {
          await db.execute('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [tt.task_id, tt.tag_id]);
        }
      }
      if (Array.isArray(data.timeEntries)) {
        for (const te of data.timeEntries) {
          await db.execute(
            'INSERT OR IGNORE INTO task_time_entries (task_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
            [te.task_id, te.date, te.start_time, te.end_time]
          );
        }
      }

      // Journal/Weekly checklist/Vocab/Quotes/Books: only wipe+restore when the backup
      // actually has that section, so importing an older backup (made before these
      // features existed) leaves the current data for them untouched instead of erasing it.
      if (Array.isArray(data.journalEntries)) {
        await db.execute('DELETE FROM journal_entries');
        for (const j of data.journalEntries) {
          await db.execute(
            'INSERT INTO journal_entries (id, date, type, items, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)',
            [j.id, j.date, j.type, j.items, j.created_at, j.updated_at]
          );
        }
      }

      if (Array.isArray(data.weeklyChecklist)) {
        await db.execute('DELETE FROM weekly_checklist');
        for (const w of data.weeklyChecklist) {
          await db.execute(
            'INSERT INTO weekly_checklist (id, week_key, text, is_done, position, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
            [w.id, w.week_key, w.text, w.is_done, w.position, w.created_at]
          );
        }
      }

      if (Array.isArray(data.vocabWords)) {
        await db.execute('DELETE FROM vocab_words');
        for (const v of data.vocabWords) {
          await db.execute(
            'INSERT INTO vocab_words (id, word, ipa, meaning, meaning_en, part_of_speech, position, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [v.id, v.word, v.ipa, v.meaning, v.meaning_en, v.part_of_speech, v.position, v.created_at]
          );
        }
      }

      if (Array.isArray(data.quotes)) {
        await db.execute('DELETE FROM quote_tags');
        await db.execute('DELETE FROM quotes');
        for (const q of data.quotes) {
          await db.execute(
            'INSERT INTO quotes (id, text, author, language, is_favorite, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
            [q.id, q.text, q.author ?? null, q.language, q.is_favorite, q.created_at]
          );
        }
        if (Array.isArray(data.quoteTags)) {
          for (const qt of data.quoteTags) {
            await db.execute('INSERT OR IGNORE INTO quote_tags (quote_id, tag) VALUES ($1, $2)', [qt.quote_id, qt.tag]);
          }
        }
      }

      if (Array.isArray(data.books)) {
        await db.execute('DELETE FROM book_tags');
        await db.execute('DELETE FROM books');
        await db.execute('DELETE FROM book_reading_goals');
        for (const b of data.books) {
          await db.execute(
            'INSERT INTO books (id, title, author, cover_image, status, started_date, finished_date, notes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [b.id, b.title, b.author ?? null, b.cover_image ?? null, b.status, b.started_date ?? null, b.finished_date ?? null, b.notes ?? null, b.created_at]
          );
        }
        if (Array.isArray(data.bookTags)) {
          for (const bt of data.bookTags) {
            await db.execute('INSERT OR IGNORE INTO book_tags (book_id, tag) VALUES ($1, $2)', [bt.book_id, bt.tag]);
          }
        }
        if (Array.isArray(data.bookReadingGoals)) {
          for (const g of data.bookReadingGoals) {
            await db.execute(
              `INSERT INTO book_reading_goals (year, goal) VALUES ($1, $2)
               ON CONFLICT(year) DO UPDATE SET goal = excluded.goal`,
              [g.year, g.goal]
            );
          }
        }
      }

      if (Array.isArray(data.projects)) {
        await db.execute('DELETE FROM project_folder_links');
        await db.execute('DELETE FROM project_folders');
        await db.execute('DELETE FROM projects');
        if (Array.isArray(data.projectFolders)) {
          for (const f of data.projectFolders) {
            await db.execute(
              'INSERT INTO project_folders (id, name, category, cover_image, created_at) VALUES ($1,$2,$3,$4,$5)',
              [f.id, f.name, f.category ?? 'product', f.cover_image ?? null, f.created_at]
            );
          }
        }
        if (Array.isArray(data.projects)) {
          for (const p of data.projects) {
            await db.execute(
              `INSERT INTO projects (id, title, category, status, start_date, completed_date, notes, link_repo, link_youtube, composer, cover_image, cover_image_thumb, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [p.id, p.title, p.category ?? 'product', p.status, p.start_date ?? null, p.completed_date ?? null, p.notes ?? null, p.link_repo ?? null, p.link_youtube ?? null, p.composer ?? null, p.cover_image ?? null, p.cover_image_thumb ?? null, p.created_at]
            );
          }
        }
        if (Array.isArray(data.projectFolderLinks)) {
          for (const l of data.projectFolderLinks) {
            await db.execute('INSERT OR IGNORE INTO project_folder_links (project_id, folder_id) VALUES ($1, $2)', [l.project_id, l.folder_id]);
          }
        }
      }
    }

    const year = new Date().getFullYear();
    await get().loadTasks(get().selectedDate);
    await get().loadGoals(get().selectedYear);
    await get().loadHeatmap(get().selectedYear);
    await get().loadCategoryColors();
    await get().loadTags();
    await get().loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
  },

  resetAllData: async () => {
    if (!isTauri()) {
      mockTasks.length = 0;
      mockGoals.length = 0;
      mockChecklist.length = 0;
      mockTags.length = 0;
      for (const k of Object.keys(mockTaskTags)) delete mockTaskTags[Number(k)];
      localStorage.removeItem('categoryColors');
    } else {
      const db = await getDb();
      await db.execute('DELETE FROM task_time_entries');
      await db.execute('DELETE FROM task_tags');
      await db.execute('DELETE FROM goal_checklist_items');
      await db.execute('DELETE FROM tasks');
      await db.execute('DELETE FROM goals');
      await db.execute('DELETE FROM category_colors');
      await db.execute('DELETE FROM tags');
    }
    const year = new Date().getFullYear();
    await get().loadTasks(get().selectedDate);
    await get().loadGoals(get().selectedYear);
    await get().loadHeatmap(get().selectedYear);
    await get().loadCategoryColors();
    await get().loadTags();
    await get().loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
  },
});
