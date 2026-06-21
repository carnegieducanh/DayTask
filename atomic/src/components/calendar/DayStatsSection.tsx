import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { IconClock } from '@tabler/icons-react';
import { useT } from '../../i18n';
import { formatMins, type DayStat } from './calendarUtils';

function StatsPopover({
  stats,
  pos,
  otherMins = 0,
  otherColor = '#7C7C7C',
}: {
  stats: DayStat[];
  pos: { top: number; left: number };
  otherMins?: number;
  otherColor?: string;
}) {
  const t = useT();
  const total = stats.reduce((sum, s) => sum + s.totalMins, 0);

  return createPortal(
    <div className="cal-stats-popup" style={{ top: pos.top, left: pos.left }}>
      {stats.length > 0 && (
        <>
          <div className="cal-week-stat-total-row">
            <span className="cal-week-stat-total-label">
              <IconClock size="0.75rem" />
              {t.calendar.statsTotal}
            </span>
            <span className="cal-week-stat-total-val">{formatMins(total)}</span>
          </div>
          <div className="cal-week-stat-bar" style={{ marginBottom: 6 }}>
            {stats.map((s) => (
              <div
                key={s.category}
                className="cal-week-stat-bar-seg"
                style={{ width: `${(s.totalMins / total) * 100}%`, background: s.color }}
              />
            ))}
          </div>
          <div className="cal-stats-popup-cats">
            {stats.map((s) => (
              <div key={s.category} className="cal-stats-popup-cat">
                <div className="cal-stats-popup-cat-left">
                  <span className="cal-week-stat-dot" style={{ background: s.color }} />
                  <span className="cal-stats-popup-cat-name">{t.cat[s.category]}</span>
                </div>
                <span className="cal-week-stat-cat-val">{formatMins(s.totalMins)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {otherMins > 0 && (
        <div
          className="cal-stats-popup-cat"
          style={stats.length > 0 ? { marginTop: 6, paddingTop: 6, borderTop: '0.5px solid var(--border-1)' } : undefined}
        >
          <div className="cal-stats-popup-cat-left">
            <span className="cal-week-stat-dot" style={{ background: otherColor }} />
            <span className="cal-stats-popup-cat-name">{t.cat.other}</span>
          </div>
          <span className="cal-week-stat-cat-val">{formatMins(otherMins)}</span>
        </div>
      )}
    </div>,
    document.body
  );
}

export default function DayStatsSection({
  stats,
  otherMins = 0,
  otherColor = '#7C7C7C',
  doneMins,
  totalMins,
}: {
  stats: DayStat[];
  otherMins?: number;
  otherColor?: string;
  doneMins?: number;
  totalMins?: number;
}) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [popPos, setPopPos] = useState({ top: 0, left: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(scrollRef);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!stats.length && otherMins <= 0) return;
    const popW = 260;
    const popH = 220;
    let left = e.clientX + 14;
    if (left + popW > window.innerWidth - 8) left = e.clientX - popW - 14;
    if (left < 8) left = 8;
    let top = e.clientY - 10;
    if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
    if (top < 8) top = 8;
    setPopPos({ top, left });
    setHovered(true);
  };

  if (!stats.length && otherMins <= 0) {
    return (
      <div className="cal-week-stats">
        <div className="cal-week-stats-empty">{t.calendar.noTasks}</div>
      </div>
    );
  }

  const total = stats.reduce((sum, s) => sum + s.totalMins, 0);

  return (
    <>
      <div
        ref={scrollRef}
        className="cal-week-stats"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        {stats.length > 0 && (
          <>
            <div className="cal-week-stat-total-row">
              <span className="cal-week-stat-total-label">
                <IconClock size="0.75rem" />
                {doneMins !== undefined ? t.calendar.statsDoneOfTotal : t.calendar.statsTotal}
              </span>
              <span className="cal-week-stat-total-val">
                {doneMins !== undefined
                  ? `${formatMins(doneMins) || '0m'} / ${formatMins(totalMins ?? total) || '0m'}`
                  : formatMins(total)}
              </span>
            </div>

            <div className="cal-week-stat-bar">
              {stats.map((s) => (
                <div
                  key={s.category}
                  className="cal-week-stat-bar-seg"
                  style={{
                    width: `${(s.totalMins / total) * 100}%`,
                    background: s.color,
                  }}
                />
              ))}
            </div>

            <div className="cal-week-stat-cats">
              {stats.map((s) => (
                <div key={s.category} className="cal-week-stat-cat">
                  <div className="cal-week-stat-cat-left">
                    <span className="cal-week-stat-dot" style={{ background: s.color }} />
                    <span className="cal-week-stat-cat-name">{t.cat[s.category]}</span>
                  </div>
                  <span className="cal-week-stat-cat-val">{formatMins(s.totalMins)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {otherMins > 0 && (
          <div
            className="cal-week-stat-cat"
            style={stats.length > 0 ? { marginTop: 4, paddingTop: 4, borderTop: '0.5px solid var(--border-1)' } : undefined}
          >
            <div className="cal-week-stat-cat-left">
              <span className="cal-week-stat-dot" style={{ background: otherColor }} />
              <span className="cal-week-stat-cat-name">{t.cat.other}</span>
            </div>
            <span className="cal-week-stat-cat-val">{formatMins(otherMins)}</span>
          </div>
        )}
      </div>
      {hovered && (stats.length > 0 || otherMins > 0) && (
        <StatsPopover stats={stats} pos={popPos} otherMins={otherMins} otherColor={otherColor} />
      )}
    </>
  );
}
