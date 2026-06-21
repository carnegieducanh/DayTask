import type { Task, CategoryColors, TaskTimeEntry, Category, Tag } from '../../types';

export function formatMins(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export type DayStat = { category: Category; color: string; totalMins: number };

function entryMins(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export type TagStat = { tagId: number; name: string; color: string; totalMins: number };

export function calcRangeCategoryStats(
  tasks: Task[],
  timeEntries: TaskTimeEntry[],
  startDate: string,
  endDate: string,
  categoryColors: CategoryColors
): DayStat[] {
  const statsMap: Partial<Record<Category, number>> = {};
  for (const cat of Object.keys(categoryColors) as Category[]) {
    statsMap[cat] = 0;
  }
  for (const task of tasks) {
    if (task.date < startDate || task.date > endDate) continue;
    const entries = timeEntries.filter((e) => e.task_id === task.id && e.date === task.date);
    for (const entry of entries) {
      const mins = entryMins(entry.start_time, entry.end_time);
      if (mins <= 0) continue;
      statsMap[task.category] = (statsMap[task.category] ?? 0) + mins;
    }
  }
  return (Object.entries(statsMap) as [Category, number][])
    .map(([category, totalMins]) => ({
      category,
      color: categoryColors[category] ?? '#7DD3FC',
      totalMins,
    }))
    .sort((a, b) => b.totalMins - a.totalMins);
}

export function calcRangeTagStats(
  tasks: Task[],
  timeEntries: TaskTimeEntry[],
  taskTags: Record<number, number[]>,
  tags: Tag[],
  startDate: string,
  endDate: string
): TagStat[] {
  const minsMap: Record<number, number> = {};
  const seen = new Set<number>();
  for (const task of tasks) {
    if (task.date < startDate || task.date > endDate) continue;
    const tagIds = taskTags[task.id] ?? [];
    if (tagIds.length === 0) continue;
    const entries = timeEntries.filter((e) => e.task_id === task.id && e.date === task.date);
    let taskMins = 0;
    for (const entry of entries) taskMins += entryMins(entry.start_time, entry.end_time);
    for (const tagId of tagIds) {
      minsMap[tagId] = (minsMap[tagId] ?? 0) + taskMins;
      seen.add(tagId);
    }
  }
  return tags
    .map((tag) => ({
      tagId: tag.id,
      name: tag.name,
      color: tag.color,
      totalMins: minsMap[tag.id] ?? 0,
    }))
    .sort((a, b) => b.totalMins - a.totalMins);
}

export function calcOtherDayMins(
  tasks: Task[],
  timeEntries: TaskTimeEntry[],
  dateStr: string,
): number {
  let total = 0;
  for (const entry of timeEntries) {
    if (entry.date !== dateStr) continue;
    const task = tasks.find((t) => t.id === entry.task_id);
    if (task?.category === 'other') {
      const [sh, sm] = entry.start_time.split(':').map(Number);
      const [eh, em] = entry.end_time.split(':').map(Number);
      total += Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }
  }
  return total;
}

export function calcRangeOtherMins(
  tasks: Task[],
  timeEntries: TaskTimeEntry[],
  startDate: string,
  endDate: string,
): number {
  let total = 0;
  for (const task of tasks) {
    if (task.date < startDate || task.date > endDate) continue;
    if (task.category !== 'other') continue;
    const entries = timeEntries.filter((e) => e.task_id === task.id && e.date === task.date);
    for (const entry of entries) total += entryMins(entry.start_time, entry.end_time);
  }
  return total;
}

export function calcWeekTotalMins(
  tasks: Task[],
  timeEntries: TaskTimeEntry[],
  startDate: string,
  endDate: string,
): number {
  let total = 0;
  for (const task of tasks) {
    if (task.date < startDate || task.date > endDate) continue;
    const entries = timeEntries.filter((e) => e.task_id === task.id && e.date === task.date);
    for (const entry of entries) total += entryMins(entry.start_time, entry.end_time);
  }
  return total;
}

export function calcDayStats(
  tasks: Task[],
  timeEntries: TaskTimeEntry[],
  dateStr: string,
  categoryColors: CategoryColors
): DayStat[] {
  const statsMap: Partial<Record<Category, number>> = {};
  for (const task of tasks) {
    if (task.date !== dateStr || task.is_done !== 1) continue;
    const entries = timeEntries.filter((e) => e.task_id === task.id && e.date === dateStr);
    for (const entry of entries) {
      const [sh, sm] = entry.start_time.split(':').map(Number);
      const [eh, em] = entry.end_time.split(':').map(Number);
      const mins = eh * 60 + em - (sh * 60 + sm);
      if (mins <= 0) continue;
      statsMap[task.category] = (statsMap[task.category] ?? 0) + mins;
    }
  }
  return (Object.entries(statsMap) as [Category, number][])
    .map(([category, totalMins]) => ({
      category,
      color: categoryColors[category] ?? '#7DD3FC',
      totalMins,
    }))
    .sort((a, b) => b.totalMins - a.totalMins);
}
