import { useRef, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { useT } from '../../i18n';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import type { Category, CategoryColors, Tag, Task, TaskTimeEntry } from '../../types';
import {
  calcRangeCategoryStats,
  calcRangeTagStats,
  calcWeekTotalMins,
  calcRangeOtherMins,
  formatMins,
} from './calendarUtils';

interface CalendarFilterSidebarProps {
  tasks: Task[];
  filteredTasks: Task[];
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
  view: string;
}

export default function CalendarFilterSidebar({
  tasks,
  filteredTasks,
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
  view,
}: CalendarFilterSidebarProps) {
  const t = useT();
  const sidebarRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(sidebarRef);
  const [tagSearch, setTagSearch] = useState('');

  const catStats = calcRangeCategoryStats(tasks, timeEntries, startDate, endDate, categoryColors);
  const tagStats = calcRangeTagStats(tasks, timeEntries, taskTags, tags, startDate, endDate);
  const hasFilter = activeCategories.size > 0 || activeTags.size > 0;

  const showStats = view === 'week' || view === 'month';
  const baseTasks = hasFilter ? filteredTasks : tasks;
  const totalMins = showStats ? calcWeekTotalMins(baseTasks, timeEntries, startDate, endDate) : 0;
  const otherRangeMins = showStats ? calcRangeOtherMins(baseTasks, timeEntries, startDate, endDate) : 0;
  const displayTotal = totalMins - otherRangeMins;

  let breakdown: { label: string; color: string; mins: number }[] = [];
  if (showStats && hasFilter) {
    if (activeCategories.size > 0) {
      const stats = calcRangeCategoryStats(filteredTasks, timeEntries, startDate, endDate, categoryColors);
      breakdown = stats
        .filter((s) => s.totalMins > 0 && s.category !== 'other')
        .map((s) => ({ label: t.cat[s.category], color: s.color, mins: s.totalMins }));
    } else if (activeTags.size > 0) {
      const stats = calcRangeTagStats(filteredTasks, timeEntries, taskTags, tags, startDate, endDate);
      breakdown = stats
        .filter((s) => s.totalMins > 0)
        .map((s) => ({ label: s.name, color: s.color, mins: s.totalMins }));
    }
  }

  return (
    <div className="cal-filter-sidebar" ref={sidebarRef}>
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

      <div className="cal-filter-sections">
        <div className="cal-filter-section">
          <div className="cal-filter-section-label">{t.calendar.filterCategories}</div>
          <div className="cal-filter-list cal-filter-list--scrollable">
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
                </button>
              );
            })}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="cal-filter-section">
            <div className="cal-filter-section-label">{t.calendar.filterTags}</div>
            <input
              className="cal-filter-tag-search"
              type="text"
              placeholder={t.calendar.filterTagSearch}
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              spellCheck={false}
            />
            <div className="cal-filter-list cal-filter-list--scrollable">
              {tagStats
                .filter((s) => !tagSearch || s.name.toLowerCase().includes(tagSearch.toLowerCase()))
                .map((s) => {
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
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {showStats && (
        <div className="cal-filter-week-stats">
          <div className="cal-filter-week-total-row">
            <span className="cal-filter-section-label">
              {view === 'week' ? t.calendar.weekStats : t.calendar.monthStats}
            </span>
            <span className="cal-filter-week-total-value">{formatMins(displayTotal) || '–'}</span>
          </div>
          {breakdown.length > 0 && (
            <div className="cal-filter-week-breakdown">
              {breakdown.map((s, i) => (
                <div key={i} className="cal-filter-week-breakdown-item">
                  <span className="cal-filter-breakdown-label">
                    <span className="cal-filter-dot" style={{ background: s.color }} />
                    <span className="cal-filter-breakdown-label-text">{s.label}</span>
                  </span>
                  <span className="cal-filter-breakdown-mins">{formatMins(s.mins)}</span>
                </div>
              ))}
            </div>
          )}
          {otherRangeMins > 0 && (
            <div
              className="cal-filter-week-breakdown-item"
              style={{ marginTop: breakdown.length > 0 ? 4 : 0 }}
            >
              <span className="cal-filter-breakdown-label">
                <span className="cal-filter-dot" style={{ background: categoryColors['other'] ?? '#7C7C7C' }} />
                <span className="cal-filter-breakdown-label-text">{t.cat.other}</span>
              </span>
              <span className="cal-filter-breakdown-mins">{formatMins(otherRangeMins)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
