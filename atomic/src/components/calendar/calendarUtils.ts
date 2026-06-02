import type { Task, CategoryColors, TaskTimeEntry, Category } from '../../types';

export function formatMins(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export type DayStat = { category: Category; color: string; totalMins: number };

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
