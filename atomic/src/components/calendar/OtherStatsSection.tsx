import { IconClock } from '@tabler/icons-react';
import { useT } from '../../i18n';
import { formatMins } from './calendarUtils';

export default function OtherStatsSection({
  totalMins,
  doneMins,
  hasBorderTop = false,
}: {
  totalMins: number;
  doneMins?: number;
  hasBorderTop?: boolean;
}) {
  const t = useT();
  if (totalMins <= 0) return null;

  return (
    <div className={`other-stats-section${hasBorderTop ? ' other-stats-section--bordered' : ''}`}>
      <div className="other-stats-row">
        <IconClock size="0.75rem" />
        <span className="other-stats-label">{t.cat.other}</span>
        {doneMins !== undefined ? (
          <span className="other-stats-val cal-week-stat-cat-val-split">
            <span className="cal-week-stat-cat-done">{formatMins(doneMins) || '0m'}</span>
            <span className="cal-week-stat-cat-sep">/</span>
            <span className="cal-week-stat-cat-sched">{formatMins(totalMins) || '0m'}</span>
          </span>
        ) : (
          <span className="other-stats-val">{formatMins(totalMins)}</span>
        )}
      </div>
    </div>
  );
}
