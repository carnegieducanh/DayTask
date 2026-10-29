import { IconBell, IconCheck, IconPencil, IconPlus, IconTelescope, IconTrash } from '@tabler/icons-react';
import type { AimItem, AimStatus, CategoryColors, Language, Vision, VisionAim, VisionAimLog } from '../../types';
import { useT } from '../../i18n';
import AimRow from './AimRow';
import { daysUntil, elapsedFraction, formatDay, groupAims, logsOf, spanParts } from './visionUtils';

interface VisionCharterProps {
  vision: Vision;
  aims: VisionAim[];
  logs: VisionAimLog[];
  lang: Language;
  today: string;
  categoryColors: CategoryColors;
  openAimId: number | null;
  justStampedId: number | null;
  onToggleAim: (id: number) => void;
  onEditVision: () => void;
  onDeleteVision: () => void;
  onMarkReviewed: () => void;
  onAddAim: () => void;
  onEditAim: (aim: VisionAim) => void;
  onDeleteAim: (aim: VisionAim) => void;
  onSetStatus: (aim: VisionAim, status: AimStatus) => void;
  onAddLog: (aim: VisionAim, date: string, value: number, note: string | null) => void;
  onDeleteLog: (id: number) => void;
  onSetItems: (aim: VisionAim, items: AimItem[]) => void;
}

const REVIEW_INTERVAL_DAYS = 90;

export default function VisionCharter(props: VisionCharterProps) {
  const { vision, aims, logs, lang, today, categoryColors } = props;
  const t = useT();

  const daysLeft = daysUntil(vision.target_date, today);
  const passed = daysLeft < 0;
  const span = spanParts(today, vision.target_date);
  const elapsed = elapsedFraction(vision.start_date, vision.target_date, today);
  const achieved = aims.filter((a) => a.status === 'achieved').length;
  const inProgress = aims.filter((a) => a.status === 'in_progress').length;
  const notStarted = aims.length - achieved - inProgress;

  const lastReview = vision.reviewed_at ?? vision.start_date;
  const reviewedToday = vision.reviewed_at === today;
  const reviewOverdue = -daysUntil(lastReview, today) >= REVIEW_INTERVAL_DAYS;

  const groups = groupAims(aims);
  let counter = 0;

  return (
    <article className="vision-paper">
      <div className="vision-paper-inner">
        <header className="vc-head">
          <div className="vc-tools">
            <button type="button" className="icon-btn" onClick={props.onEditVision} title={t.vision.visionModalEdit}>
              <IconPencil size={15} />
            </button>
            <button type="button" className="icon-btn" onClick={props.onDeleteVision} title={t.vision.delete}>
              <IconTrash size={15} />
            </button>
          </div>
          <div className="vc-eyebrow">
            {passed ? t.vision.eyebrowPassed(formatDay(vision.target_date, lang)) : t.vision.eyebrowDue(formatDay(vision.target_date, lang))}
          </div>
          <h2 className="vc-title">{vision.title}</h2>
          {vision.motto ? (
            <p className="vc-motto">“{vision.motto}”</p>
          ) : (
            <button type="button" className="vc-motto vc-motto-empty" onClick={props.onEditVision}>
              {t.vision.mottoPlaceholder}
            </button>
          )}
          <div className="vc-orn" aria-hidden="true"><i /></div>
        </header>

        <section className="vc-pace">
          <div className="vc-count">
            <span className="vc-count-num">{Math.abs(daysLeft).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</span>
            <span className="vc-count-unit">{daysLeft === 0 ? t.vision.dueToday : passed ? t.vision.daysPast : t.vision.daysLeft}</span>
            {!passed && daysLeft > 0 && (
              <span className="vc-count-sub">
                {t.vision.untilDate(t.vision.span(span.years, span.months, span.days), formatDay(vision.target_date, lang))}
              </span>
            )}
          </div>
          <div className="vc-bars">
            <div className="vc-bar">
              <span className="vc-bar-label">{t.vision.timeElapsed}</span>
              <div className="vc-bar-track"><div className="vc-bar-fill" style={{ width: `${elapsed * 100}%` }} /></div>
              <span className="vc-bar-val">{Math.round(elapsed * 100)}%</span>
            </div>
            <div className="vc-bar">
              <span className="vc-bar-label">{t.vision.aimsAchieved}</span>
              {aims.length ? (
                <div className="vc-bar-segs">
                  {[...aims]
                    .sort((a, b) => rank(a.status) - rank(b.status))
                    .map((a) => <i key={a.id} className={a.status === 'achieved' ? 'done' : a.status === 'in_progress' ? 'doing' : ''} />)}
                </div>
              ) : (
                <div className="vc-bar-track" />
              )}
              <span className="vc-bar-val">{aims.length ? `${achieved} / ${aims.length}` : '—'}</span>
            </div>
            {aims.length > 0 && (
              <div className="vc-legend">{t.vision.paceLegend(inProgress, notStarted, formatDay(vision.start_date, lang))}</div>
            )}
          </div>
        </section>

        <section className="vc-aims">
          <div className="vc-aims-head">
            <h3>
              {t.vision.commitments}
              {aims.length > 0 && <span>{aims.length}</span>}
            </h3>
            {aims.length > 0 && (
              <button type="button" className="vc-ghost-btn" onClick={props.onAddAim}>
                <IconPlus size={14} />
                {t.vision.addAim}
              </button>
            )}
          </div>

          {aims.length === 0 ? (
            <div className="vc-empty">
              <IconTelescope size={28} stroke={1.4} />
              <h4>{t.vision.emptyAimsTitle}</h4>
              <p>{t.vision.emptyAimsDesc}</p>
              <button type="button" className="btn btn-primary vc-empty-btn" onClick={props.onAddAim}>
                <IconPlus size={15} />
                {t.vision.addFirstAim}
              </button>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="vc-group">
                <div className="vc-group-label">
                  <i style={{ background: categoryColors[g.category] }} />
                  <span>{t.cat[g.category]}</span>
                  <span className="vc-group-count">{g.aims.length}</span>
                </div>
                {g.aims.map((aim) => {
                  counter += 1;
                  return (
                    <AimRow
                      key={aim.id}
                      aim={aim}
                      number={counter}
                      logs={logsOf(aim.id, logs)}
                      lang={lang}
                      today={today}
                      visionTarget={vision.target_date}
                      open={props.openAimId === aim.id}
                      justStamped={props.justStampedId === aim.id}
                      onToggle={() => props.onToggleAim(aim.id)}
                      onSetStatus={(s) => props.onSetStatus(aim, s)}
                      onAddLog={(d, v, n) => props.onAddLog(aim, d, v, n)}
                      onDeleteLog={props.onDeleteLog}
                      onSetItems={(items) => props.onSetItems(aim, items)}
                      onEdit={() => props.onEditAim(aim)}
                      onDelete={() => props.onDeleteAim(aim)}
                    />
                  );
                })}
              </div>
            ))
          )}
        </section>

        <footer className="vc-foot">
          <span className="vc-foot-sig">
            {t.vision.createdOn(formatDay(vision.start_date, lang))}
            {' · '}
            {vision.reviewed_at ? t.vision.reviewedOn(formatDay(vision.reviewed_at, lang)) : t.vision.neverReviewed}
          </span>
          <div className="vc-foot-right">
            <span className={reviewOverdue && !reviewedToday ? 'vc-overdue' : ''}>
              {reviewOverdue && !reviewedToday ? t.vision.reviewOverdue : t.vision.reviewQuarterly}
            </span>
            <button type="button" className="vc-ghost-btn" onClick={props.onMarkReviewed} disabled={reviewedToday}>
              {reviewedToday ? <IconCheck size={14} /> : <IconBell size={14} />}
              {reviewedToday ? t.vision.reviewedToday : t.vision.markReviewed}
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}

const rank = (s: AimStatus) => (s === 'achieved' ? 0 : s === 'in_progress' ? 1 : 2);
