import { Fragment } from 'react';
import { IconPlus } from '@tabler/icons-react';
import type { Language, Vision, VisionAim } from '../../types';
import { useT } from '../../i18n';
import { ageOn, formatDay, monthsBetween } from './visionUtils';

interface HorizonRailProps {
  visions: Vision[];
  aims: VisionAim[];
  selectedId: number | null;
  today: string;
  birthDate: string | null;
  lang: Language;
  onSelect: (id: number) => void;
  onAdd: () => void;
}

// Khoảng cách giữa 2 nút tỉ lệ với số năm (14px/năm), kẹp trong [20, 96] để không quá sát/quá xa.
const gapHeight = (months: number) => Math.min(96, Math.max(20, (months / 12) * 14));

export default function HorizonRail({ visions, aims, selectedId, today, birthDate, lang, onSelect, onAdd }: HorizonRailProps) {
  const t = useT();
  const upcoming = visions.filter((v) => v.target_date >= today);
  const past = visions.filter((v) => v.target_date < today).reverse();

  function renderItem(v: Vision, isPast: boolean) {
    const own = aims.filter((a) => a.vision_id === v.id);
    const done = own.filter((a) => a.status === 'achieved').length;
    return (
      <li
        className={`vh-item${v.id === selectedId ? ' active' : ''}${!own.length ? ' draft' : ''}${isPast ? ' past' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(v.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(v.id); } }}
      >
        {!isPast && <span className="vh-node"><i /></span>}
        <div className="vh-card">
          <div className="vh-title">{v.title}</div>
          <div className="vh-sub">
            {v.target_date.slice(0, 4)} · {own.length ? t.vision.achievedOf(done, own.length) : t.vision.noAimsShort}
          </div>
          {own.length > 0 && (
            <div className="vh-mini">
              {own.map((a) => <i key={a.id} className={a.status === 'achieved' ? 'done' : a.status === 'in_progress' ? 'doing' : ''} />)}
            </div>
          )}
        </div>
      </li>
    );
  }

  let prevDate = today;

  return (
    <aside className="vision-rail">
      <div className="vision-rail-head">
        <span className="vision-label">{t.vision.horizon}</span>
        <button type="button" className="icon-btn" onClick={onAdd} title={t.vision.addVision}>
          <IconPlus size={15} />
        </button>
      </div>

      <ol className="vision-horizon">
        <li className="vh-item vh-now">
          <span className="vh-node"><i /></span>
          <div className="vh-card">
            <div className="vh-now-title">{t.vision.today}</div>
            <div className="vh-sub">
              {birthDate ? `${t.vision.age(ageOn(birthDate, today))} · ` : ''}
              {formatDay(today, lang)}
            </div>
          </div>
        </li>
        {upcoming.map((v) => {
          const months = Math.max(0, monthsBetween(prevDate, v.target_date));
          prevDate = v.target_date;
          return (
            <Fragment key={v.id}>
              <li className="vh-gap" style={{ height: gapHeight(months) }} aria-hidden="true">
                {months > 0 ? t.vision.gap(Math.floor(months / 12), months % 12) : ''}
              </li>
              {renderItem(v, false)}
            </Fragment>
          );
        })}
      </ol>

      <div className="vision-rail-past">
        <span className="vision-label">{t.vision.passed}</span>
        {past.length ? (
          <ol className="vision-past-list">
            {past.map((v) => <Fragment key={v.id}>{renderItem(v, true)}</Fragment>)}
          </ol>
        ) : (
          <p>{t.vision.passedEmpty}</p>
        )}
      </div>
    </aside>
  );
}
