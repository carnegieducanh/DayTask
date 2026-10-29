import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './heatmap.css';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, addDays, isToday, format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import type { CategoryStat, TagStat } from '../../types';
import HeatmapGrid from './HeatmapGrid';
import TopStatsSection, { type StatItem } from './TopStatsSection';
import { fmtMinutes, fmtHoursFloat, fmtDateRange } from './heatmapFormat';

// ── Small presentational pieces ─────────────────────────────────────────────

function SectionHead({ num, title, children }: { num: string; title: string; children?: ReactNode }) {
  return (
    <div className="hv-section-head">
      <span className="hv-section-num">{num}</span>
      <h2 className="hv-section-title">{title}</h2>
      {children}
    </div>
  );
}

function PeriodNav({
  label, prevLabel, nextLabel, onPrev, onNext, nextDisabled,
}: {
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="hv-period-nav">
      <button className="hv-round-btn" onClick={onPrev} title={prevLabel} aria-label={prevLabel}>
        <IconChevronLeft size={15} />
      </button>
      <span className="hv-period-label">{label}</span>
      <button className="hv-round-btn" onClick={onNext} disabled={nextDisabled} title={nextLabel} aria-label={nextLabel}>
        <IconChevronRight size={15} />
      </button>
    </div>
  );
}

function Figure({
  label, value, unit, sub, children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  children?: ReactNode; // inline extras after the value (delta…)
}) {
  return (
    <div className="hv-figure">
      <span className="hv-figure-label">{label}</span>
      <span className="hv-figure-value">
        <span className="hv-figure-num">{value}</span>
        {unit && <span className="hv-figure-unit">{unit}</span>}
        {children}
      </span>
      {sub && <span className="hv-figure-sub">{sub}</span>}
    </div>
  );
}

function MonthChart({
  bars, labels, activeIdx,
}: {
  bars: { pct: number; title: string }[];
  labels: string[];
  activeIdx: number | null;
}) {
  return (
    <div className="hv-chart">
      {bars.map((b, i) => (
        <div key={i} className="hv-chart-col" title={b.title}>
          <div className="hv-chart-track">
            <div className={`hv-chart-bar${i === activeIdx ? ' active' : ''}`} style={{ height: `${b.pct}%` }} />
          </div>
          <span className="hv-chart-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Bar height in % of the track — non-zero values keep a visible sliver.
function barPct(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.max(4, Math.round((value / Math.max(max, 1)) * 100));
}

// ── HeatmapView ─────────────────────────────────────────────────────────────

export default function HeatmapView() {
  const t = useT();
  const {
    heatmap, heatmapDurations, heatmapMonthStats, heatmapTopTagHours,
    heatmapWeekCategoryStats, heatmapWeekCategoryStatsPrev, heatmapWeekTagStats, heatmapWeekTagStatsPrev,
    heatmapMonthCategoryStats, heatmapMonthCategoryStatsPrev, heatmapMonthTagStats, heatmapMonthTagStatsPrev,
    heatmapWeekDayActivity, heatmapWeekDayDurations, heatmapMonthSummary, heatmapMonthSummaryPrev,
    selectedYear, setSelectedYear,
    loadHeatmap, loadHeatmapDurations, loadHeatmapMonthStats, loadHeatmapTopTagHours,
    loadHeatmapWeekCategoryStats, loadHeatmapWeekCategoryStatsPrev, loadHeatmapWeekTagStats, loadHeatmapWeekTagStatsPrev,
    loadHeatmapMonthCategoryStats, loadHeatmapMonthCategoryStatsPrev, loadHeatmapMonthTagStats, loadHeatmapMonthTagStatsPrev,
    loadHeatmapWeekDayActivity, loadHeatmapWeekDayDurations, loadHeatmapMonthSummary, loadHeatmapMonthSummaryPrev,
    getStreak,
    language, categoryColors,
  } = useAppStore();
  const [streak, setStreak] = useState(0);
  const [heatmapMode, setHeatmapMode] = useState<'count' | 'hours'>('hours');
  const [weekCompare, setWeekCompare] = useState(false);
  const [monthCompare, setMonthCompare] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, ...
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, ...
  const contentRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(contentRef);
  const dateLocale = language === 'vi' ? viLocale : undefined;

  useEffect(() => {
    loadHeatmap(selectedYear);
    loadHeatmapDurations(selectedYear);
    loadHeatmapMonthStats(selectedYear);
    getStreak().then(setStreak);
  }, [selectedYear]);

  // Week tier — navigable via weekOffset, independent of the year picker above.
  const weekStartDate = useMemo(
    () => addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset),
    [weekOffset]
  );
  const weekEndDate = useMemo(() => endOfWeek(weekStartDate, { weekStartsOn: 0 }), [weekStartDate]);

  useEffect(() => {
    const weekStart = format(weekStartDate, 'yyyy-MM-dd');
    const weekEnd = format(weekEndDate, 'yyyy-MM-dd');
    const prevWeekStart = format(addWeeks(weekStartDate, -1), 'yyyy-MM-dd');
    const prevWeekEnd = format(addWeeks(weekEndDate, -1), 'yyyy-MM-dd');
    const sortBy = heatmapMode === 'hours' ? 'minutes' : 'tasks';
    loadHeatmapWeekCategoryStats(weekStart, weekEnd, sortBy);
    loadHeatmapWeekTagStats(weekStart, weekEnd, sortBy);
    loadHeatmapWeekCategoryStatsPrev(prevWeekStart, prevWeekEnd, sortBy);
    loadHeatmapWeekTagStatsPrev(prevWeekStart, prevWeekEnd, sortBy);
    loadHeatmapWeekDayActivity(weekStart, weekEnd);
    loadHeatmapWeekDayDurations(weekStart, weekEnd);
  }, [heatmapMode, weekStartDate, weekEndDate]);

  // Month tier — navigable via monthOffset, independent of the year picker above.
  const monthStartDate = useMemo(
    () => addMonths(startOfMonth(new Date()), monthOffset),
    [monthOffset]
  );
  const monthEndDate = useMemo(() => endOfMonth(monthStartDate), [monthStartDate]);

  useEffect(() => {
    const monthStart = format(monthStartDate, 'yyyy-MM-dd');
    const monthEnd = format(monthEndDate, 'yyyy-MM-dd');
    const prevMonthStartDate = addMonths(monthStartDate, -1);
    const prevMonthEndDate = endOfMonth(prevMonthStartDate);
    const prevMonthStart = format(prevMonthStartDate, 'yyyy-MM-dd');
    const prevMonthEnd = format(prevMonthEndDate, 'yyyy-MM-dd');
    const sortBy = heatmapMode === 'hours' ? 'minutes' : 'tasks';
    loadHeatmapMonthCategoryStats(monthStart, monthEnd, sortBy);
    loadHeatmapMonthTagStats(monthStart, monthEnd, sortBy);
    loadHeatmapMonthCategoryStatsPrev(prevMonthStart, prevMonthEnd, sortBy);
    loadHeatmapMonthTagStatsPrev(prevMonthStart, prevMonthEnd, sortBy);
    loadHeatmapMonthSummary(monthStart, monthEnd);
    loadHeatmapMonthSummaryPrev(prevMonthStart, prevMonthEnd);
    loadHeatmapTopTagHours(`${format(monthStartDate, 'yyyy-MM')}-`);
  }, [heatmapMode, monthStartDate, monthEndDate]);

  const isCurrentYear = selectedYear === new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const activeMonthIdx = isCurrentYear ? currentMonth : null;

  // ── Basic aggregates ──────────────────────────────────────────────────────
  const totalDone    = heatmap.reduce((s, d) => s + d.count, 0);
  const activeDays   = heatmap.length;
  const totalMinutes = heatmapDurations.reduce((s, d) => s + d.minutes, 0);

  // Per-day counts for the navigated week (heatmapWeekDayActivity/-Durations are fetched
  // by explicit date range, independent of selectedYear — see weekOffset effect above).
  const weekTaskMap = useMemo(() => {
    const m: Record<string, number> = {};
    heatmapWeekDayActivity.forEach((d) => { m[d.date] = d.count; });
    return m;
  }, [heatmapWeekDayActivity]);

  const weekDurationMap = useMemo(() => {
    const m: Record<string, number> = {};
    heatmapWeekDayDurations.forEach((d) => { m[d.date] = d.minutes; });
    return m;
  }, [heatmapWeekDayDurations]);

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

  // ── This month / prev month comparison (independent of selectedYear — see monthOffset effect above) ──
  const thisMonthStat = heatmapMonthSummary;
  const prevMonthStat = heatmapMonthSummaryPrev;
  const thisMonthMinutes = heatmapMonthSummary.minutes;
  const prevMonthMinutes = heatmapMonthSummaryPrev.minutes;

  const tasksDelta    = thisMonthStat.done - prevMonthStat.done;
  const minutesDelta  = thisMonthMinutes - prevMonthMinutes;

  const thisMonthRate = thisMonthStat.created > 0
    ? Math.round((thisMonthStat.done / thisMonthStat.created) * 100)
    : null;

  // ── Weekly summary strip ──────────────────────────────────────────────────
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)),
    [weekStartDate]
  );

  // ── Nav labels (between the prev/next buttons) ────────────────────────────
  const weekRangeLabel = useMemo(
    () => fmtDateRange(weekStartDate, weekEndDate, dateLocale),
    [weekStartDate, weekEndDate, dateLocale]
  );
  const monthRangeLabel = useMemo(
    () => t.calendar.monthLabel(monthStartDate.getMonth() + 1, monthStartDate.getFullYear()),
    [monthStartDate, t]
  );
  const prevWeekRangeLabel = useMemo(() => {
    const prevStart = addWeeks(weekStartDate, -1);
    const prevEnd = addWeeks(weekEndDate, -1);
    return fmtDateRange(prevStart, prevEnd, dateLocale);
  }, [weekStartDate, weekEndDate, dateLocale]);
  const prevMonthRangeLabel = useMemo(() => {
    const prevMonthStartDate = addMonths(monthStartDate, -1);
    return t.calendar.monthLabel(prevMonthStartDate.getMonth() + 1, prevMonthStartDate.getFullYear());
  }, [monthStartDate, t]);

  // TopStatsSection titles fall back to plain "This Week"/"This Month" only when
  // sitting on the current period — once navigated, show the actual range instead.
  const weekPeriodTitle  = weekOffset === 0 ? t.heatmap.weeklySummary : weekRangeLabel;
  const weekPeriodPrev   = weekOffset === 0 ? t.heatmap.prevWeek : prevWeekRangeLabel;
  const monthPeriodTitle = monthOffset === 0 ? t.heatmap.thisMonth : monthRangeLabel;
  const monthPeriodPrev  = monthOffset === 0 ? t.heatmap.prevMonth : prevMonthRangeLabel;

  // ── Record helpers ────────────────────────────────────────────────────────
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
    key: c.category, name: t.cat[c.category], color: categoryColors[c.category], tasks: c.tasks, days: c.days, minutes: c.minutes,
  });
  const mapTag = (tag: TagStat): StatItem => ({
    key: tag.name, name: tag.name, color: tag.color, tasks: tag.tasks, days: tag.days, minutes: tag.minutes,
  });

  const weekCategoriesList     = useMemo(() => heatmapWeekCategoryStats.map(mapCategory), [heatmapWeekCategoryStats, categoryColors, t]);
  const weekCategoriesListPrev = useMemo(() => heatmapWeekCategoryStatsPrev.map(mapCategory), [heatmapWeekCategoryStatsPrev, categoryColors, t]);
  const weekTagsList           = useMemo(() => heatmapWeekTagStats.map(mapTag), [heatmapWeekTagStats]);
  const weekTagsListPrev       = useMemo(() => heatmapWeekTagStatsPrev.map(mapTag), [heatmapWeekTagStatsPrev]);

  const monthCategoriesList     = useMemo(() => heatmapMonthCategoryStats.map(mapCategory), [heatmapMonthCategoryStats, categoryColors, t]);
  const monthCategoriesListPrev = useMemo(() => heatmapMonthCategoryStatsPrev.map(mapCategory), [heatmapMonthCategoryStatsPrev, categoryColors, t]);
  const monthTagsList           = useMemo(() => heatmapMonthTagStats.map(mapTag), [heatmapMonthTagStats]);
  const monthTagsListPrev       = useMemo(() => heatmapMonthTagStatsPrev.map(mapTag), [heatmapMonthTagStatsPrev]);

  // ── Year charts ───────────────────────────────────────────────────────────
  const taskBars = monthlyTotals.map((count, i) => ({
    pct: barPct(count, maxMonthly),
    title: `${t.heatmap.monthsShort[i]}: ${count}`,
  }));

  const completionRates = monthStatsArray.map((m) => (m.created > 0 ? Math.round((m.done / m.created) * 100) : 0));
  const maxCompletionRate = Math.max(...completionRates, 1);
  const completionBars = monthStatsArray.map((ms, i) => ({
    pct: barPct(completionRates[i], maxCompletionRate),
    title: `${t.heatmap.monthsShort[i]}: ${completionRates[i]}% (${ms.done}/${ms.created})`,
  }));

  const deltaClass = (d: number) => (d > 0 ? ' up' : d < 0 ? ' down' : '');

  return (
    <div className="hv-wrap" ref={contentRef}>
      <div className="hv-page">

        <header className="hv-head">
          <div className="hv-head-main">
            <span className="hv-eyebrow">{t.nav.heatmap}</span>
            <div className="hv-title-row">
              <h1 className="hv-title">{t.heatmap.tierYear} {selectedYear}</h1>
              <div className="hv-year-nav">
                <button
                  className="hv-round-btn"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  title={t.nav.prevYear}
                  aria-label={t.nav.prevYear}
                >
                  <IconChevronLeft size={16} />
                </button>
                <button
                  className="hv-round-btn"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  title={t.nav.nextYear}
                  aria-label={t.nav.nextYear}
                >
                  <IconChevronRight size={16} />
                </button>
              </div>
            </div>
            <p className="hv-subtitle">{t.heatmap.subtitle(totalDone, activeDays)}</p>
          </div>
          <div className="hv-tabs">
            <button
              className={`hv-tab${heatmapMode === 'count' ? ' active' : ''}`}
              onClick={() => setHeatmapMode('count')}
            >
              {t.heatmap.countMode}
            </button>
            <button
              className={`hv-tab${heatmapMode === 'hours' ? ' active' : ''}`}
              onClick={() => setHeatmapMode('hours')}
            >
              {t.heatmap.hoursMode}
            </button>
          </div>
        </header>

        {/* Tuần + Tháng lên đầu (chỉ có ở năm hiện tại), Năm xuống cuối — số La Mã theo thứ tự hiển thị */}

        {/* ═══════════════════════ I · TUẦN ═══════════════════════ */}
        {isCurrentYear && (
          <section className="hv-section">
            <SectionHead num="I" title={t.heatmap.tierWeek}>
              <PeriodNav
                label={weekRangeLabel}
                prevLabel={t.heatmap.prevWeek}
                nextLabel={t.heatmap.nextWeek}
                onPrev={() => setWeekOffset((o) => o - 1)}
                onNext={() => setWeekOffset((o) => o + 1)}
                nextDisabled={weekOffset >= 0}
              />
            </SectionHead>

            <div className="hv-week">
              {weekDays.map((day) => {
                const dateStr  = format(day, 'yyyy-MM-dd');
                const tasks    = weekTaskMap[dateStr] ?? 0;
                const mins     = weekDurationMap[dateStr] ?? 0;
                const dayLabel = language === 'vi'
                  ? format(day, 'EEE', { locale: viLocale })
                  : format(day, 'EEE');
                const cls = [
                  'hv-day',
                  isToday(day) && 'today',
                  tasks === 0 && mins === 0 && 'empty',
                ].filter(Boolean).join(' ');
                return (
                  <div key={dateStr} className={cls}>
                    <span className="hv-day-dow">{dayLabel}</span>
                    <span className="hv-day-date">{format(day, 'd')}</span>
                    <span className="hv-day-tasks">{tasks > 0 ? `${tasks} task` : '—'}</span>
                    <span className="hv-day-hours">
                      {mins > 0 ? fmtMinutes(mins, t.heatmap.hourUnitShort, t.heatmap.minuteUnitShort) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            <TopStatsSection
              title={weekPeriodTitle}
              mode={heatmapMode}
              compare={weekCompare}
              onCompareChange={setWeekCompare}
              categoriesLabel={heatmapMode === 'hours' ? t.heatmap.topCategoriesHours : t.heatmap.topCategories}
              tagsLabel={heatmapMode === 'hours' ? t.heatmap.topHours : t.heatmap.topTags}
              categoriesCurrent={weekCategoriesList}
              categoriesPrev={weekCategoriesListPrev}
              tagsCurrent={weekTagsList}
              tagsPrev={weekTagsListPrev}
              currentLabel={weekPeriodTitle}
              prevLabel={weekPeriodPrev}
            />
          </section>
        )}

        {/* ═══════════════════════ II · THÁNG ═══════════════════════ */}
        {isCurrentYear && (
          <section className="hv-section">
            <SectionHead num="II" title={t.heatmap.tierMonth}>
              <PeriodNav
                label={monthRangeLabel}
                prevLabel={t.heatmap.prevMonth}
                nextLabel={t.heatmap.nextMonth}
                onPrev={() => setMonthOffset((o) => o - 1)}
                onNext={() => setMonthOffset((o) => o + 1)}
                nextDisabled={monthOffset >= 0}
              />
            </SectionHead>

            <div className="hv-figures hv-figures--md">
              <Figure label={t.heatmap.tasksDone} value={thisMonthStat.done}>
                {prevMonthStat.done > 0 && (
                  <span className={`hv-delta${deltaClass(tasksDelta)}`}>
                    {tasksDelta > 0 ? `+${tasksDelta}` : tasksDelta}
                  </span>
                )}
              </Figure>

              <Figure
                label={t.heatmap.totalHours}
                value={thisMonthMinutes > 0 ? fmtHoursFloat(thisMonthMinutes) : '—'}
                unit={thisMonthMinutes > 0 ? t.heatmap.hoursUnit : undefined}
              >
                {prevMonthMinutes > 0 && minutesDelta !== 0 && (
                  <span className={`hv-delta${deltaClass(minutesDelta)}`}>
                    {minutesDelta > 0 ? `+${fmtHoursFloat(minutesDelta)}` : fmtHoursFloat(minutesDelta)} {t.heatmap.hoursUnit}
                  </span>
                )}
              </Figure>

              {thisMonthRate !== null && (
                <Figure
                  label={t.heatmap.completionRate}
                  value={`${thisMonthRate}%`}
                  sub={
                    <span className="hv-rate-bar" aria-hidden>
                      <span style={{ width: `${thisMonthRate}%` }} />
                    </span>
                  }
                />
              )}

              {heatmapTopTagHours && (
                <Figure
                  label={t.heatmap.topTagHours}
                  value={
                    <>
                      <i className="hv-dot" style={{ background: heatmapTopTagHours.color }} />
                      <span className="hv-figure-text">{heatmapTopTagHours.name}</span>
                    </>
                  }
                  sub={`${fmtHoursFloat(heatmapTopTagHours.minutes)} ${t.heatmap.hoursUnit}`}
                />
              )}
            </div>

            <TopStatsSection
              title={monthPeriodTitle}
              mode={heatmapMode}
              compare={monthCompare}
              onCompareChange={setMonthCompare}
              categoriesLabel={heatmapMode === 'hours' ? t.heatmap.topCategoriesMonthHours : t.heatmap.topCategoriesMonth}
              tagsLabel={heatmapMode === 'hours' ? t.heatmap.topHoursMonth : t.heatmap.topTagsMonth}
              categoriesCurrent={monthCategoriesList}
              categoriesPrev={monthCategoriesListPrev}
              tagsCurrent={monthTagsList}
              tagsPrev={monthTagsListPrev}
              currentLabel={monthPeriodTitle}
              prevLabel={monthPeriodPrev}
            />
          </section>
        )}

        {/* ═══════════════════════ III · NĂM ═══════════════════════ */}
        <section className="hv-section">
          <SectionHead num={isCurrentYear ? 'III' : 'I'} title={t.heatmap.tierYear} />

          <div className="hv-figures">
            <Figure label={t.heatmap.currentStreak} value={streak} sub={t.heatmap.streakDays} />
            <Figure label={t.heatmap.activeDays} value={activeDays} sub={t.heatmap.activeDaysIn(selectedYear)} />
            <Figure label={t.heatmap.tasksDone} value={totalDone} sub={t.heatmap.totalIn(selectedYear)} />
            <Figure label={t.heatmap.totalHours} value={fmtHoursFloat(totalMinutes)} sub={t.heatmap.hoursIn(selectedYear)} />
          </div>

          <div className="hv-block">
            <div className="hv-label">{t.heatmap.activityIn(selectedYear)}</div>
            <HeatmapGrid
              year={selectedYear}
              data={heatmap}
              mode={heatmapMode}
              durations={heatmapDurations}
            />
          </div>

          <div className="hv-charts">
            <div className="hv-block">
              <div className="hv-label">{t.heatmap.tasksByMonth}</div>
              <MonthChart bars={taskBars} labels={t.heatmap.monthsShort} activeIdx={activeMonthIdx} />
            </div>
            <div className="hv-block">
              <div className="hv-label">{t.heatmap.completionTrend}</div>
              <MonthChart bars={completionBars} labels={t.heatmap.monthsShort} activeIdx={activeMonthIdx} />
            </div>
          </div>

          <div className="hv-block">
            <div className="hv-label">{t.heatmap.records}</div>
            <div className="hv-figures hv-figures--sm">
              <Figure label={t.heatmap.longestStreak} value={longestStreak} unit={t.heatmap.dayUnit} />
              <Figure label={t.heatmap.mostActiveDay} value={mostActiveDay ? formatDay(mostActiveDay.date) : '—'} />
              <Figure label={t.heatmap.avgPerDay} value={avgPerDay} />
              <Figure
                label={t.heatmap.bestMonth}
                value={bestMonthIdx !== null ? t.heatmap.bestMonthLabel(bestMonthIdx + 1) : '—'}
              />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
