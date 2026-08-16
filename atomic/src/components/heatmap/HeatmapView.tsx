import { useEffect, useMemo, useRef, useState } from 'react';
import './heatmap.css';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, addDays, isToday, format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import {
  IconTrophy, IconCalendar, IconChartBar, IconAward,
} from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import type { CategoryStat, TagStat } from '../../types';
import HeatmapGrid from './HeatmapGrid';
import TopStatsSection, { type StatItem } from './TopStatsSection';
import { fmtMinutes, fmtHoursFloat } from './heatmapFormat';

export default function HeatmapView() {
  const t = useT();
  const {
    heatmap, heatmapDurations, heatmapMonthStats, heatmapTopTagHours,
    heatmapWeekCategoryStats, heatmapWeekCategoryStatsPrev, heatmapWeekTagStats, heatmapWeekTagStatsPrev,
    heatmapMonthCategoryStats, heatmapMonthCategoryStatsPrev, heatmapMonthTagStats, heatmapMonthTagStatsPrev,
    selectedYear, setSelectedYear,
    loadHeatmap, loadHeatmapDurations, loadHeatmapMonthStats, loadHeatmapTopTagHours,
    loadHeatmapWeekCategoryStats, loadHeatmapWeekCategoryStatsPrev, loadHeatmapWeekTagStats, loadHeatmapWeekTagStatsPrev,
    loadHeatmapMonthCategoryStats, loadHeatmapMonthCategoryStatsPrev, loadHeatmapMonthTagStats, loadHeatmapMonthTagStatsPrev,
    getStreak,
    language, categoryColors,
  } = useAppStore();
  const [streak, setStreak] = useState(0);
  const [heatmapMode, setHeatmapMode] = useState<'count' | 'hours'>('hours');
  const [weekCompare, setWeekCompare] = useState(false);
  const [monthCompare, setMonthCompare] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(contentRef);

  useEffect(() => {
    const today = new Date();
    const yearMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`;
    loadHeatmap(selectedYear);
    loadHeatmapDurations(selectedYear);
    loadHeatmapMonthStats(selectedYear);
    loadHeatmapTopTagHours(yearMonthPrefix);
    getStreak().then(setStreak);
  }, [selectedYear]);

  // Week tier — this week vs last week, independent of the year picker above (always "now").
  useEffect(() => {
    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const prevWeekStart = format(subWeeks(startOfWeek(today, { weekStartsOn: 0 }), 1), 'yyyy-MM-dd');
    const prevWeekEnd = format(subWeeks(endOfWeek(today, { weekStartsOn: 0 }), 1), 'yyyy-MM-dd');
    const sortBy = heatmapMode === 'hours' ? 'minutes' : 'tasks';
    loadHeatmapWeekCategoryStats(weekStart, weekEnd, sortBy);
    loadHeatmapWeekTagStats(weekStart, weekEnd, sortBy);
    loadHeatmapWeekCategoryStatsPrev(prevWeekStart, prevWeekEnd, sortBy);
    loadHeatmapWeekTagStatsPrev(prevWeekStart, prevWeekEnd, sortBy);
  }, [heatmapMode]);

  // Month tier — this month vs last month, independent of the year picker above (always "now").
  useEffect(() => {
    const today = new Date();
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
    const prevMonth = subMonths(today, 1);
    const prevMonthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
    const sortBy = heatmapMode === 'hours' ? 'minutes' : 'tasks';
    loadHeatmapMonthCategoryStats(monthStart, monthEnd, sortBy);
    loadHeatmapMonthTagStats(monthStart, monthEnd, sortBy);
    loadHeatmapMonthCategoryStatsPrev(prevMonthStart, prevMonthEnd, sortBy);
    loadHeatmapMonthTagStatsPrev(prevMonthStart, prevMonthEnd, sortBy);
  }, [heatmapMode]);

  const isCurrentYear = selectedYear === new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed

  // ── Basic aggregates ──────────────────────────────────────────────────────
  const totalDone    = heatmap.reduce((s, d) => s + d.count, 0);
  const activeDays   = heatmap.length;
  const totalMinutes = heatmapDurations.reduce((s, d) => s + d.minutes, 0);

  const taskMap = useMemo(() => {
    const m: Record<string, number> = {};
    heatmap.forEach((d) => { m[d.date] = d.count; });
    return m;
  }, [heatmap]);

  const durationMap = useMemo(() => {
    const m: Record<string, number> = {};
    heatmapDurations.forEach((d) => { m[d.date] = d.minutes; });
    return m;
  }, [heatmapDurations]);

  // ── Monthly totals (tasks) ────────────────────────────────────────────────
  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    heatmap.forEach(({ date, count }) => {
      totals[parseInt(date.slice(5, 7)) - 1] += count;
    });
    return totals;
  }, [heatmap]);

  const maxMonthly = Math.max(...monthlyTotals, 1);

  // ── Full 12-month stats array (completion trend) ──────────────────────────
  const monthStatsArray = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, created: 0, done: 0 }));
    heatmapMonthStats.forEach((s) => { arr[s.month - 1] = s; });
    return arr;
  }, [heatmapMonthStats]);

  // ── This month / prev month comparison ───────────────────────────────────
  const thisMonthStat = isCurrentYear ? monthStatsArray[currentMonth] : null;
  const prevMonthStat = isCurrentYear && currentMonth > 0 ? monthStatsArray[currentMonth - 1] : null;

  const thisMonthMinutes = useMemo(() => {
    if (!isCurrentYear) return 0;
    const prefix = `${selectedYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return heatmapDurations.filter((d) => d.date.startsWith(prefix)).reduce((s, d) => s + d.minutes, 0);
  }, [heatmapDurations, selectedYear, currentMonth, isCurrentYear]);

  const prevMonthMinutes = useMemo(() => {
    if (!isCurrentYear || currentMonth === 0) return 0;
    const prefix = `${selectedYear}-${String(currentMonth).padStart(2, '0')}-`;
    return heatmapDurations.filter((d) => d.date.startsWith(prefix)).reduce((s, d) => s + d.minutes, 0);
  }, [heatmapDurations, selectedYear, currentMonth, isCurrentYear]);

  const tasksDelta    = thisMonthStat && prevMonthStat ? thisMonthStat.done - prevMonthStat.done : null;
  const minutesDelta  = isCurrentYear ? thisMonthMinutes - prevMonthMinutes : null;

  const thisMonthRate = thisMonthStat && thisMonthStat.created > 0
    ? Math.round((thisMonthStat.done / thisMonthStat.created) * 100)
    : null;

  // ── Weekly summary strip ──────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  // ── Bottom stat helpers ───────────────────────────────────────────────────
  const longestStreak = useMemo(() => {
    if (heatmap.length === 0) return 0;
    const dates = heatmap.map((d) => d.date).sort();
    let longest = 1, current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i]     + 'T00:00:00');
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) { current++; if (current > longest) longest = current; }
      else current = 1;
    }
    return longest;
  }, [heatmap]);

  const mostActiveDay = useMemo(() => {
    if (heatmap.length === 0) return null;
    return heatmap.reduce((max, d) => d.count > max.count ? d : max);
  }, [heatmap]);

  const bestMonthIdx = useMemo(() => {
    const max = Math.max(...monthlyTotals);
    return max === 0 ? null : monthlyTotals.indexOf(max);
  }, [monthlyTotals]);

  const avgPerDay = activeDays > 0 ? (totalDone / activeDays).toFixed(1) : '0';

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return t.heatmap.dayFormat(d);
  };

  // ── Category/Tag stats normalized to a shared shape for TopStatsSection ────
  const mapCategory = (c: CategoryStat): StatItem => ({
    key: c.category, name: t.cat[c.category], color: categoryColors[c.category], tasks: c.tasks, minutes: c.minutes,
  });
  const mapTag = (tag: TagStat): StatItem => ({
    key: tag.name, name: tag.name, color: tag.color, tasks: tag.tasks, minutes: tag.minutes,
  });

  const weekCategoriesList     = useMemo(() => heatmapWeekCategoryStats.map(mapCategory), [heatmapWeekCategoryStats, categoryColors, t]);
  const weekCategoriesListPrev = useMemo(() => heatmapWeekCategoryStatsPrev.map(mapCategory), [heatmapWeekCategoryStatsPrev, categoryColors, t]);
  const weekTagsList           = useMemo(() => heatmapWeekTagStats.map(mapTag), [heatmapWeekTagStats]);
  const weekTagsListPrev       = useMemo(() => heatmapWeekTagStatsPrev.map(mapTag), [heatmapWeekTagStatsPrev]);

  const monthCategoriesList     = useMemo(() => heatmapMonthCategoryStats.map(mapCategory), [heatmapMonthCategoryStats, categoryColors, t]);
  const monthCategoriesListPrev = useMemo(() => heatmapMonthCategoryStatsPrev.map(mapCategory), [heatmapMonthCategoryStatsPrev, categoryColors, t]);
  const monthTagsList           = useMemo(() => heatmapMonthTagStats.map(mapTag), [heatmapMonthTagStats]);
  const monthTagsListPrev       = useMemo(() => heatmapMonthTagStatsPrev.map(mapTag), [heatmapMonthTagStatsPrev]);

  // ── Completion trend ──────────────────────────────────────────────────────
  const maxCompletionRate = Math.max(
    ...monthStatsArray.map((m) => m.created > 0 ? Math.round(m.done / m.created * 100) : 0),
    1
  );

  return (
    <>
      <div className="view-topbar">
        <div>
          <div className="view-title">{t.heatmap.title}</div>
          <div className="view-subtitle">{t.heatmap.subtitle(totalDone, activeDays)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => setSelectedYear(selectedYear - 1)}>←</button>
          <span style={{ fontSize: 15, fontWeight: 500, minWidth: 40, textAlign: 'center' }}>
            {selectedYear}
          </span>
          <button className="icon-btn" onClick={() => setSelectedYear(selectedYear + 1)}>→</button>
        </div>
      </div>

      <div className="view-content" ref={contentRef}>

        {/* ═══════════════════════ TUẦN ═══════════════════════ */}
        <div className="heatmap-tier-header">{t.heatmap.tierWeek}</div>

        {isCurrentYear && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>{t.heatmap.weeklySummary}</div>
            <div className="weekly-strip">
              {weekDays.map((day) => {
                const dateStr   = format(day, 'yyyy-MM-dd');
                const tasks     = taskMap[dateStr] ?? 0;
                const mins      = durationMap[dateStr] ?? 0;
                const isTodayFl = isToday(day);
                const dayLabel  = language === 'vi'
                  ? format(day, 'EEE', { locale: viLocale })
                  : format(day, 'EEE');
                return (
                  <div key={dateStr} className={`weekly-strip-cell${isTodayFl ? ' weekly-strip-cell--today' : ''}`}>
                    <div className="weekly-strip-dow">{dayLabel}</div>
                    <div className="weekly-strip-date">{format(day, 'd')}</div>
                    <div className="weekly-strip-tasks">{tasks > 0 ? `${tasks} task` : '—'}</div>
                    <div className="weekly-strip-hours">{mins > 0 ? fmtMinutes(mins) : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCurrentYear && (
          <TopStatsSection
            title={t.heatmap.weeklySummary}
            mode={heatmapMode}
            compare={weekCompare}
            onCompareChange={setWeekCompare}
            categoriesLabel={heatmapMode === 'hours' ? t.heatmap.topCategoriesHours : t.heatmap.topCategories}
            tagsLabel={heatmapMode === 'hours' ? t.heatmap.topHours : t.heatmap.topTags}
            categoriesCurrent={weekCategoriesList}
            categoriesPrev={weekCategoriesListPrev}
            tagsCurrent={weekTagsList}
            tagsPrev={weekTagsListPrev}
            currentLabel={t.heatmap.weeklySummary}
            prevLabel={t.heatmap.prevWeek}
          />
        )}

        {/* ═══════════════════════ THÁNG ═══════════════════════ */}
        <div className="heatmap-tier-header">{t.heatmap.tierMonth}</div>

        {isCurrentYear && thisMonthStat && (
          <div className="heatmap-month-summary">
            <div className="month-card-row month-card-row--first">
              <span className="month-card-label">{t.heatmap.thisMonth}</span>
              <span className="month-card-val">{t.heatmap.monthsShort[currentMonth]}</span>
            </div>

            <div className="month-card-row">
              <span className="month-card-label">{t.heatmap.tasksDone}</span>
              <div className="month-card-right">
                <span className="month-card-val">{thisMonthStat.done}</span>
                {tasksDelta !== null && prevMonthStat && prevMonthStat.done > 0 && (
                  <span className={`month-card-delta${tasksDelta > 0 ? ' delta-up' : tasksDelta < 0 ? ' delta-down' : ''}`}>
                    {tasksDelta > 0 ? `+${tasksDelta}` : tasksDelta}
                  </span>
                )}
              </div>
            </div>

            <div className="month-card-row">
              <span className="month-card-label">{t.heatmap.totalHours}</span>
              <div className="month-card-right">
                <span className="month-card-val">
                  {thisMonthMinutes > 0 ? `${fmtHoursFloat(thisMonthMinutes)}${t.heatmap.hoursUnit}` : '—'}
                </span>
                {minutesDelta !== null && prevMonthMinutes > 0 && minutesDelta !== 0 && (
                  <span className={`month-card-delta${minutesDelta > 0 ? ' delta-up' : ' delta-down'}`}>
                    {minutesDelta > 0 ? `+${fmtHoursFloat(minutesDelta)}` : `${fmtHoursFloat(minutesDelta)}`}{t.heatmap.hoursUnit}
                  </span>
                )}
              </div>
            </div>

            {thisMonthRate !== null && (
              <div className="month-card-rate-wrap">
                <div className="month-card-rate-header">
                  <span className="month-card-label">{t.heatmap.completionRate}</span>
                  <span className="month-card-val">{thisMonthRate}%</span>
                </div>
                <div className="month-card-rate-bar">
                  <div className="month-card-rate-fill" style={{ width: `${thisMonthRate}%` }} />
                </div>
              </div>
            )}

            {heatmapTopTagHours && (
              <div className="month-card-row">
                <span className="month-card-label">{t.heatmap.topTagHours}</span>
                <div className="month-card-right">
                  <span
                    className="month-card-tag-dot"
                    style={{ background: heatmapTopTagHours.color }}
                  />
                  <span className="month-card-val">{heatmapTopTagHours.name}</span>
                  <span className="month-card-delta" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    {fmtHoursFloat(heatmapTopTagHours.minutes)}{t.heatmap.hoursUnit}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {isCurrentYear && (
          <TopStatsSection
            title={t.heatmap.thisMonth}
            mode={heatmapMode}
            compare={monthCompare}
            onCompareChange={setMonthCompare}
            categoriesLabel={heatmapMode === 'hours' ? t.heatmap.topCategoriesMonthHours : t.heatmap.topCategoriesMonth}
            tagsLabel={heatmapMode === 'hours' ? t.heatmap.topHoursMonth : t.heatmap.topTagsMonth}
            categoriesCurrent={monthCategoriesList}
            categoriesPrev={monthCategoriesListPrev}
            tagsCurrent={monthTagsList}
            tagsPrev={monthTagsListPrev}
            currentLabel={t.heatmap.thisMonth}
            prevLabel={t.heatmap.prevMonth}
          />
        )}

        {/* ═══════════════════════ NĂM ═══════════════════════ */}
        <div className="heatmap-tier-header">{t.heatmap.tierYear} {selectedYear}</div>

        <div className="stats-row stats-row--4">
          <div className="stat-card">
            <div className="stat-label">{t.heatmap.currentStreak}</div>
            <div className="stat-value">{streak}</div>
            <div className="stat-sub">{t.heatmap.streakDays}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t.heatmap.activeDays}</div>
            <div className="stat-value">{activeDays}</div>
            <div className="stat-sub">{t.heatmap.activeDaysIn(selectedYear)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t.heatmap.tasksDone}</div>
            <div className="stat-value">{totalDone}</div>
            <div className="stat-sub">{t.heatmap.totalIn(selectedYear)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t.heatmap.totalHours}</div>
            <div className="stat-value">{fmtHoursFloat(totalMinutes)}</div>
            <div className="stat-sub">{t.heatmap.hoursIn(selectedYear)}</div>
          </div>
        </div>

        {/* ── Heatmap grid + mode toggle ────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-label">{t.heatmap.activityIn(selectedYear)}</div>
            <div className="heatmap-mode-toggle">
              <button
                className={`heatmap-mode-btn${heatmapMode === 'count' ? ' heatmap-mode-btn--active' : ''}`}
                onClick={() => setHeatmapMode('count')}
              >
                {t.heatmap.countMode}
              </button>
              <button
                className={`heatmap-mode-btn${heatmapMode === 'hours' ? ' heatmap-mode-btn--active' : ''}`}
                onClick={() => setHeatmapMode('hours')}
              >
                {t.heatmap.hoursMode}
              </button>
            </div>
          </div>
          <HeatmapGrid
            year={selectedYear}
            data={heatmap}
            mode={heatmapMode}
            durations={heatmapDurations}
          />
        </div>

        {/* ── Monthly bar chart ────────────────────────────────────────────── */}
        <div>
          <div className="section-label" style={{ marginBottom: 12 }}>{t.heatmap.tasksByMonth}</div>
          <div className="monthly-chart">
            {monthlyTotals.map((count, i) => {
              const barH     = Math.round((count / maxMonthly) * 80) || (count > 0 ? 3 : 0);
              const isActive = isCurrentYear && i === currentMonth;
              return (
                <div key={i} className="monthly-bar-col">
                  <div className="monthly-bar-track">
                    <div
                      className={`monthly-bar${isActive ? ' monthly-bar--active' : ''}`}
                      style={{ height: barH }}
                      title={`${t.heatmap.monthsShort[i]}: ${count}`}
                    />
                  </div>
                  <span className="monthly-bar-label">{t.heatmap.monthsShort[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Completion rate trend ─────────────────────────────────────────── */}
        <div>
          <div className="section-label" style={{ marginBottom: 12 }}>{t.heatmap.completionTrend}</div>
          <div className="monthly-chart">
            {monthStatsArray.map((ms, i) => {
              const rate    = ms.created > 0 ? Math.round((ms.done / ms.created) * 100) : 0;
              const barH    = Math.round((rate / Math.max(maxCompletionRate, 1)) * 80) || (rate > 0 ? 3 : 0);
              const isActive = isCurrentYear && i === currentMonth;
              return (
                <div key={i} className="monthly-bar-col">
                  <div className="monthly-bar-track" title={`${t.heatmap.monthsShort[i]}: ${rate}% (${ms.done}/${ms.created})`}>
                    <div
                      className={`monthly-bar completion-bar${isActive ? ' monthly-bar--active' : ''}`}
                      style={{ height: barH }}
                    />
                  </div>
                  <span className="monthly-bar-label">{t.heatmap.monthsShort[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom 4 stat cards ───────────────────────────────────────────── */}
        <div className="stats-row-4">
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">{t.heatmap.longestStreak}</div>
            <div className="stat-card-sm-row">
              <IconTrophy size={20} className="stat-card-sm-icon stat-icon-trophy" />
              <span className="stat-card-sm-value">{longestStreak}</span>
              <span className="stat-card-sm-unit">{t.heatmap.dayUnit}</span>
            </div>
          </div>
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">{t.heatmap.mostActiveDay}</div>
            <div className="stat-card-sm-row">
              <IconCalendar size={20} className="stat-card-sm-icon" />
              <span className="stat-card-sm-value">
                {mostActiveDay ? formatDay(mostActiveDay.date) : '—'}
              </span>
            </div>
          </div>
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">{t.heatmap.avgPerDay}</div>
            <div className="stat-card-sm-row">
              <IconChartBar size={20} className="stat-card-sm-icon" />
              <span className="stat-card-sm-value">{avgPerDay}</span>
            </div>
          </div>
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">{t.heatmap.bestMonth}</div>
            <div className="stat-card-sm-row">
              <IconAward size={20} className="stat-card-sm-icon stat-icon-award" />
              <span className="stat-card-sm-value">
                {bestMonthIdx !== null ? t.heatmap.bestMonthLabel(bestMonthIdx + 1) : '—'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
