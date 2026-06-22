import { IconClock } from '@tabler/icons-react';
import { useT } from '../../i18n';
import { formatMins } from './calendarUtils';

export default function OtherStatsSection({ totalMins, hasBorderTop = false }: { totalMins: number; hasBorderTop?: boolean }) {
  const t = useT();
  if (totalMins <= 0) return null;

  return (
    <div className={`other-stats-section${hasBorderTop ? ' other-stats-section--bordered' : ''}`}>
      <div className="other-stats-row">
        <IconClock size="0.75rem" />
        <span className="other-stats-label">{t.cat.other}</span>
        <span className="other-stats-val">{formatMins(totalMins)}</span>
      </div>
    </div>
  );
}
