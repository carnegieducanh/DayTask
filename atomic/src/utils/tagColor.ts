import type { Category, CategoryColors, Task } from '../types';

// Màu tag = màu của category mà tag thực sự được dùng cùng (2026-11-23).
// Cột `tags.color` trong DB vẫn giữ (NOT NULL, có trong backup) nhưng không dùng để hiển thị nữa —
// nhờ vậy màu tag tự đổi theo khi người dùng đổi màu category trong Cài đặt.
//
// Hai tầng:
//  - Màu theo khoảng (Lịch tuần/tháng, Heatmap tuần/tháng): category có nhiều task ĐÃ XONG nhất
//    trong khoảng đang xem. Chỉ đếm task đã xong vì chuỗi lặp hằng ngày sinh ra rất nhiều bản
//    chưa bao giờ làm (vd. "jp speaking" — learn) sẽ lấn át việc thật (vd. "luyện tập interview" — work).
//  - Màu chung (Cài đặt, và dự phòng khi khoảng đang xem chưa có task nào xong): ưu tiên task đã xong
//    trong 30 ngày gần nhất → task đã xong từ trước tới giờ → mọi task → hòa thì category dùng gần nhất.

export const TAG_RECENT_DAYS = 30;

/** Thống kê một cặp (tag, category). */
export interface TagCategoryRow {
  tag_id: number;
  category: Category;
  /** số task đã xong trong TAG_RECENT_DAYS ngày gần nhất */
  n_recent: number;
  /** số task đã xong */
  n_done: number;
  /** số task (kể cả chưa xong) */
  n: number;
  last_date: string;
}

function outranks(a: TagCategoryRow, b: TagCategoryRow): boolean {
  if (a.n_recent !== b.n_recent) return a.n_recent > b.n_recent;
  if (a.n_done !== b.n_done) return a.n_done > b.n_done;
  if (a.n !== b.n) return a.n > b.n;
  return a.last_date > b.last_date;
}

/** Chọn category cho mỗi tag theo thứ tự ưu tiên ở đầu file. */
export function pickTagCategories(rows: TagCategoryRow[]): Record<number, Category> {
  const best: Record<number, TagCategoryRow> = {};
  for (const row of rows) {
    const cur = best[row.tag_id];
    if (!cur || outranks(row, cur)) best[row.tag_id] = row;
  }
  const result: Record<number, Category> = {};
  for (const [tagId, row] of Object.entries(best)) result[Number(tagId)] = row.category;
  return result;
}

/** Category của mỗi tag trong khoảng [startDate, endDate], chỉ tính task đã xong. Tag không có task xong → không có mặt. */
export function tagCategoriesInRange(
  tasks: Task[],
  taskTags: Record<number, number[]>,
  startDate: string,
  endDate: string,
): Record<number, Category> {
  const rows = new Map<string, TagCategoryRow>();
  for (const task of tasks) {
    if (task.is_done !== 1 || task.date < startDate || task.date > endDate) continue;
    for (const tagId of taskTags[task.id] ?? []) {
      const key = `${tagId}|${task.category}`;
      const row = rows.get(key);
      if (row) {
        row.n_done += 1;
        row.n += 1;
        if (task.date > row.last_date) row.last_date = task.date;
      } else {
        rows.set(key, { tag_id: tagId, category: task.category, n_recent: 0, n_done: 1, n: 1, last_date: task.date });
      }
    }
  }
  return pickTagCategories([...rows.values()]);
}

/** Màu chung của tag. Tag chưa gắn task nào → màu của "other". */
export function resolveTagColor(
  tagId: number,
  tagCategories: Record<number, Category>,
  categoryColors: CategoryColors,
): string {
  return categoryColors[tagCategories[tagId] ?? 'other'] ?? categoryColors.other;
}
