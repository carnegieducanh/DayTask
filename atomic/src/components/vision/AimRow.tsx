import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import type { AimItem, AimStatus, Language, VisionAim, VisionAimLog } from '../../types';
import { useT } from '../../i18n';
import AimMeasure from './AimMeasure';
import AimDetail from './AimDetail';
import {
  bestLog, formatAmount, formatMonth, isReached, latestLog, monthsBetween, stepDone, toRoman,
} from './visionUtils';

interface AimRowProps {
  aim: VisionAim;
  number: number;
  logs: VisionAimLog[];
  lang: Language;
  today: string;
  visionTarget: string;
  open: boolean;
  justStamped: boolean;
  onToggle: () => void;
  onSetStatus: (status: AimStatus) => void;
  onAddLog: (date: string, value: number, note: string | null) => void;
  onDeleteLog: (id: number) => void;
  onSetItems: (items: AimItem[]) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const STATUSES: AimStatus[] = ['not_started', 'in_progress', 'achieved'];

export default function AimRow(props: AimRowProps) {
  const { aim, number, logs, lang, today, visionTarget, open, justStamped, onToggle, onSetStatus } = props;
  const t = useT();
  const achieved = aim.status === 'achieved';
  const reached = isReached(aim, logs);
  const isBinary = aim.kind === 'checklist' && aim.items.length === 0;
  const canStamp = !achieved && (reached || isBinary);

  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuPos) return;
    const close = (e: Event) => {
      if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
      setMenuPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuPos(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [menuPos]);

  function openMenu(e: React.MouseEvent<HTMLElement>) {
    e.stopPropagation();
    if (menuPos) { setMenuPos(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const width = 176;
    setMenuPos({ top: r.bottom + 6, left: Math.min(r.right - width, window.innerWidth - width - 8) });
  }

  // ── Dòng phụ dưới tên ──
  const meta: React.ReactNode[] = [];
  if (achieved && aim.achieved_date) {
    meta.push(<span key="ach" className="vr-meta-seal">{t.vision.achievedOn(formatMonth(aim.achieved_date, lang))}</span>);
  } else if (reached) {
    meta.push(<span key="reached" className="vr-meta-seal">{t.vision.reachedHint}</span>);
  }
  if (aim.kind === 'score') {
    const last = latestLog(logs);
    if (!achieved) meta.push(last ? <span key="last">{t.vision.lastAttempt(formatMonth(last.date, lang))}</span> : <span key="last">{t.vision.noAttemptYet}</span>);
    else if (bestLog(logs)) meta.push(<span key="best">{t.vision.best} {bestLog(logs)!.value}</span>);
  } else if (aim.kind === 'amount') {
    const latest = latestLog(logs);
    if (latest) {
      meta.push(<span key="upd">{t.vision.balanceUpdated(formatMonth(latest.date, lang))}</span>);
      const remaining = (aim.target_value ?? 0) - latest.value;
      const months = monthsBetween(today, visionTarget);
      if (!achieved && remaining > 0 && months > 0) {
        meta.push(<span key="pm">{t.vision.perMonthNeeded(formatAmount(Math.ceil((remaining / months) * 10) / 10, aim.unit, lang))}</span>);
      }
    } else if (!achieved) {
      meta.push(<span key="upd">{t.vision.noBalanceYet}</span>);
    }
  } else if (aim.kind === 'level' && !achieved) {
    const target = aim.items[aim.target_value ?? -1];
    if (target?.parts.length && !stepDone(target)) {
      const done = target.parts.filter((p) => p.done).map((p) => p.name).join(', ');
      const left = target.parts.filter((p) => !p.done).map((p) => p.name).join(', ');
      meta.push(<span key="lv" className="vr-jp">{done ? t.vision.levelPartsDone(done, left) : t.vision.levelOf(target.name)}</span>);
    } else if (target) {
      meta.push(<span key="lv" className="vr-jp">{t.vision.levelOf(target.name)}</span>);
    }
  }
  if (!achieved) {
    if (aim.next_step) meta.push(<span key="next">{t.vision.next(aim.next_step, aim.next_date ? formatMonth(aim.next_date, lang) : null)}</span>);
    else if (aim.kind === 'checklist') meta.push(<span key="next">{t.vision.noNextStep}</span>);
  }

  return (
    <div className={`vr${open ? ' is-open' : ''}${achieved ? ' achieved' : ''}`}>
      <div
        className="vr-row"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
      >
        <span className="vr-num">{toRoman(number)}</span>
        <div className="vr-main">
          <div className="vr-title">{aim.title}</div>
          {meta.length > 0 && (
            <div className="vr-meta">
              {/* Dấu chấm đi theo phần đứng trước để khi xuống dòng nó nằm cuối dòng, không rơi xuống đầu dòng mới */}
              {meta.map((m, i) => (
                <span key={i} className="vr-meta-part">
                  {m}
                  {i < meta.length - 1 && <i className="vr-dot" />}
                </span>
              ))}
            </div>
          )}
        </div>
        <AimMeasure aim={aim} logs={logs} lang={lang} />
        <div className="vr-status">
          {achieved ? (
            <button
              type="button"
              className={`vision-seal${justStamped ? ' stamp' : ''}`}
              onClick={openMenu}
              title={t.vision.status.achieved}
            >
              <b>{t.vision.seal}</b>
              {aim.achieved_date && <span>{formatMonth(aim.achieved_date, lang).replace('.', ' · ')}</span>}
            </button>
          ) : (
            <button type="button" className={`vr-pill vr-pill-${aim.status}`} onClick={openMenu}>
              {t.vision.status[aim.status]}
            </button>
          )}
          <IconChevronRight size={15} className="vr-chev" />
        </div>
      </div>

      {open && (
        <AimDetail
          aim={aim}
          logs={logs}
          lang={lang}
          canStamp={canStamp}
          onStamp={() => onSetStatus('achieved')}
          onAddLog={props.onAddLog}
          onDeleteLog={props.onDeleteLog}
          onSetItems={props.onSetItems}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
        />
      )}

      {menuPos && createPortal(
        <div ref={menuRef} className="vision-status-menu" style={{ top: menuPos.top, left: menuPos.left }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`vision-status-item${aim.status === s ? ' active' : ''}`}
              onClick={() => { setMenuPos(null); if (s !== aim.status) onSetStatus(s); }}
            >
              <span className={`vision-status-dot vision-status-dot-${s}`} />
              {t.vision.status[s]}
              {aim.status === s && <IconCheck size={14} className="vision-status-check" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
