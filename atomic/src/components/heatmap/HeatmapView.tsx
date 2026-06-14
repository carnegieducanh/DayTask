import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfWeek, endOfWeek, addDays, isToday, format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import {
  IconTrophy, IconCalendar, IconChartBar, IconAward,
} from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import HeatmapGrid from './HeatmapGrid';

function fmtMinutes(minutes: number): string {
  if (minutes <= 0) return '0p';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}g${m}p`;
  if (h > 0) return `${h}g`;
  return `${m}p`;
}

function fmtHoursFloat(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

// Mon-first order for charts: [1,2,3,4,5,6,0] → T2..CN
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function HeatmapView() {
  const t = useT();
  const {
    heatmap, heatmapDurations, heatmapTagStats, heatmapMonthStats, heatmapTopTagHours,
    selectedYear, setSelectedYear,
    loadHeatmap, loadHeatmapDurations, loadHeatmapTagStats, loadHeatmapMonthStats, loadHeatmapTopTagHours,
    getStreak,
    language,
  } = useAppStore();
  const [streak, setStreak] = useState(0);
  const [heatmapMode, setHeatmapMode] = useState<'count' | 'hours'>('hours');
  const contentRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(contentRef);

  useEffect(() => {
    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd   = format(endOfWeek(today,   { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const yearMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`;
    loadHeatmap(selectedYear);
    loadHeatmapDurations(selectedYear);
    loadHeatmapTagStats(weekStart, weekEnd);
    loadHeatmapMonthStats(selectedYear);
    loadHeatmapTopTagHours(yearMonthPrefix);
    getStreak().then(setStreak);
  }, [selectedYear]);

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
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  // ── Day-of-week pattern ───────────────────────────────────────────────────
  const dowData = useMemo(() => {
    const tasksByDow = Array(7).fill(0);
    const minsByDow  = Array(7).fill(0);

    heatmap.forEach(({ date, count }) => {
      tasksByDow[new Date(date + 'T00:00:00').getDay()] += count;
    });
    heatmapDurations.forEach(({ date, minutes }) => {
      minsByDow[new Date(date + 'T00:00:00').getDay()] += minutes;
    });

    // Count occurrences of each weekday in the selected year
    const occurrences = Array(7).fill(0);
    const isLeap = (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || selectedYear % 400 === 0;
    for (let i = 0; i < (isLeap ? 366 : 365); i++) {
      occurrences[new Date(selectedYear, 0, 1 + i).getDay()]++;
    }

    return DOW_ORDER.map((dow) => ({
      tasks:   occurrences[dow] > 0 ? Math.round((tasksByDow[dow] / occurrences[dow]) * 10) / 10 : 0,
      minutes: occurrences[dow] > 0 ? Math.round(minsByDow[dow] / occurrences[dow]) : 0,
    }));
  }, [heatmap, heatmapDurations, selectedYear]);

  const maxDowTasks = Math.max(...dowData.map((d) => d.tasks), 0.1);
  const maxDowMins  = Math.max(...dowData.map((d) => d.minutes), 1);
  const dowLabels   = DOW_ORDER.map((i) => t.heatmap.weekDowShort[i]);

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

  // ── Top tags max ──────────────────────────────────────────────────────────
  const maxTagTasks = Math.max(...heatmapTagStats.map((t) => t.tasks), 1);

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

        {/* ── 4 top stat cards ─────────────────────────────────────────────── */}
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

        {/* ── Weekly summary strip (current year only) ──────────────────────── */}
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

        {/* ── This month summary strip ──────────────────────────────────────── */}
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

        {/* ── DoW pattern + Top tags ─────────────────────────────────────────── */}
        <div className="heatmap-two-col">
          {/* Day-of-week pattern */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{ marginBottom: 12 }}>
              <div className="section-label">{t.heatmap.dowPattern(selectedYear)}</div>
              <div className="section-note">{t.heatmap.dowPatternNote}</div>
            </div>
            <div className="dow-chart">
              {dowData.map((day, i) => {
                const val   = heatmapMode === 'hours' ? day.minutes : day.tasks;
                const max   = heatmapMode === 'hours' ? maxDowMins : maxDowTasks;
                const barH  = Math.round((val / max) * 72) || (val > 0 ? 3 : 0);
                const label = heatmapMode === 'hours' ? fmtMinutes(day.minutes) : String(day.tasks);
                return (
                  <div key={i} className="dow-col">
                    <div className="dow-bar-track">
                      <div className="dow-bar" style={{ height: barH }} />
                    </div>
                    <span className="dow-label">{dowLabels[i]}</span>
                    <span className="dow-value">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top tags */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>{t.heatmap.topTags}</div>
            {heatmapTagStats.length === 0 ? (
              <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{t.heatmap.noTagData}</div>
            ) : (
              <div className="tag-stats-list">
                {heatmapTagStats.map((tag) => (
                  <div key={tag.name} className="tag-stat-row">
                    <span className="tag-stat-name" style={{ color: tag.color }}>{tag.name}</span>
                    <div className="tag-stat-bar-wrap">
                      <div
                        className="tag-stat-bar"
                        style={{
                          width: `${Math.round((tag.tasks / maxTagTasks) * 100)}%`,
                          background: tag.color,
                        }}
                      />
                    </div>
                    <span className="tag-stat-count">{tag.tasks}</span>
                    {tag.minutes > 0 && (
                      <span className="tag-stat-hours">{fmtMinutes(tag.minutes)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
