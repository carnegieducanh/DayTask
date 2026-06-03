import { IconX } from '@tabler/icons-react';
import { useT } from '../../i18n';
import type { Category, CategoryColors, Tag, Task, TaskTimeEntry } from '../../types';
import {
  calcRangeCategoryStats,
  calcRangeTagStats,
  formatMins,
} from './calendarUtils';

interface CalendarFilterSidebarProps {
  tasks: Task[];
  timeEntries: TaskTimeEntry[];
  taskTags: Record<number, number[]>;
  tags: Tag[];
  categoryColors: CategoryColors;
  startDate: string;
  endDate: string;
  activeCategories: Set<Category>;
  activeTags: Set<number>;
  onToggleCategory: (cat: Category) => void;
  onToggleTag: (tagId: number) => void;
  onReset: () => void;
}

export default function CalendarFilterSidebar({
  tasks,
  timeEntries,
  taskTags,
  tags,
  categoryColors,
  startDate,
  endDate,
  activeCategories,
  activeTags,
  onToggleCategory,
  onToggleTag,
  onReset,
}: CalendarFilterSidebarProps) {
  const t = useT();

  const catStats = calcRangeCategoryStats(tasks, timeEntries, startDate, endDate, categoryColors);
  const tagStats = calcRangeTagStats(tasks, timeEntries, taskTags, tags, startDate, endDate);
  const hasFilter = activeCategories.size > 0 || activeTags.size > 0;

  return (
    <div className="cal-filter-sidebar">
      <div className="cal-filter-header">
        <span className="cal-filter-title">{t.calendar.filterTitle}</span>
        <button
          className="cal-filter-reset"
          onClick={onReset}
          style={{ visibility: hasFilter ? 'visible' : 'hidden' }}
        >
          <IconX size="0.7rem" />
          {t.calendar.filterReset}
        </button>
      </div>

      <div className="cal-filter-section">
        <div className="cal-filter-section-label">{t.calendar.filterCategories}</div>
        <div className="cal-filter-list">
          {catStats.map((s) => {
            const active = activeCategories.has(s.category);
            return (
              <button
                key={s.category}
                className={`cal-filter-item${active ? ' active' : ''}`}
                onClick={() => onToggleCategory(s.category)}
              >
                <span className="cal-filter-dot" style={{ background: s.color }} />
                <span className="cal-filter-item-name">{t.cat[s.category]}</span>
                {s.totalMins > 0 && (
                  <span className="cal-filter-item-time">{formatMins(s.totalMins)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="cal-filter-section">
          <div className="cal-filter-section-label">{t.calendar.filterTags}</div>
          <div className="cal-filter-list">
            {tagStats.map((s) => {
              const active = activeTags.has(s.tagId);
              return (
                <button
                  key={s.tagId}
                  className={`cal-filter-item${active ? ' active' : ''}`}
                  onClick={() => onToggleTag(s.tagId)}
                >
                  <span
                    className="cal-filter-tag-chip"
                    style={{ background: s.color }}
                  />
                  <span className="cal-filter-item-name">{s.name}</span>
                  {s.totalMins > 0 && (
                    <span className="cal-filter-item-time">{formatMins(s.totalMins)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
