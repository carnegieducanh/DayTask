import { useState } from 'react';
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { AimItem, Language, VisionAim, VisionAimLog } from '../../types';
import { useT } from '../../i18n';
import AimChart from './AimChart';
import { bestLog, formatAmount, formatDay, formatMonth, formatNumber, scaleOf, stepDone, todayISO } from './visionUtils';

interface AimDetailProps {
  aim: VisionAim;
  logs: VisionAimLog[];
  lang: Language;
  canStamp: boolean;
  onStamp: () => void;
  onAddLog: (date: string, value: number, note: string | null) => void;
  onDeleteLog: (id: number) => void;
  onSetItems: (items: AimItem[]) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function AimDetail({
  aim, logs, lang, canStamp, onStamp, onAddLog, onDeleteLog, onSetItems, onEdit, onDelete,
}: AimDetailProps) {
  const t = useT();
  const isScore = aim.kind === 'score';
  const isAmount = aim.kind === 'amount';

  return (
    <div className="vd">
      {canStamp && (
        <div className="vd-stamp-banner">
          <span>{aim.kind === 'checklist' && !aim.items.length ? t.vision.binaryHint : t.vision.reachedHint}</span>
          <button type="button" className="vd-stamp-btn" onClick={onStamp}>{t.vision.stampIt}</button>
        </div>
      )}

      {(isScore || isAmount) && (
        <LogPanel aim={aim} logs={logs} lang={lang} onAddLog={onAddLog} onDeleteLog={onDeleteLog} />
      )}
      {aim.kind === 'level' && <LevelEditor aim={aim} onSetItems={onSetItems} />}
      {aim.kind === 'checklist' && aim.items.length > 0 && <ChecklistEditor aim={aim} onSetItems={onSetItems} />}

      <div className="vd-actions">
        <button type="button" className="vd-action" onClick={onEdit}>
          <IconPencil size={14} />
          {t.vision.edit}
        </button>
        <button type="button" className="vd-action vd-action-danger" onClick={onDelete}>
          <IconTrash size={14} />
          {t.vision.delete}
        </button>
      </div>
    </div>
  );
}

// ── Lần thi / số dư ──

function LogPanel({
  aim, logs, lang, onAddLog, onDeleteLog,
}: Pick<AimDetailProps, 'aim' | 'logs' | 'lang' | 'onAddLog' | 'onDeleteLog'>) {
  const t = useT();
  const isScore = aim.kind === 'score';
  const [date, setDate] = useState(todayISO());
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const best = isScore ? bestLog(logs) : null;
  const { min, max } = scaleOf(aim);
  const fmt = (n: number) => (isScore ? formatNumber(n, lang) : formatAmount(n, aim.unit, lang));

  function submit() {
    const v = parseFloat(value.replace(',', '.'));
    if (!date || Number.isNaN(v)) return;
    onAddLog(date, v, note.trim() || null);
    setValue('');
    setNote('');
  }

  return (
    <div className="vd-logs">
      <div className="vd-log-col">
        <div className="vd-head">{isScore ? t.vision.attempts : t.vision.balances}</div>
        {logs.length > 0 && (
          <table className="vd-table">
            <tbody>
              {[...logs].reverse().map((l) => (
                <tr key={l.id}>
                  <td>{formatDay(l.date, lang)}</td>
                  <td className="vd-num">
                    {fmt(l.value)}
                    {best?.id === l.id && <span className="vd-best">{t.vision.best}</span>}
                  </td>
                  <td className="vd-note">{l.note}</td>
                  <td className="vd-del-cell">
                    <button type="button" className="vd-del" title={t.vision.deleteLog} onClick={() => onDeleteLog(l.id)}>
                      <IconX size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form
          className="vd-add-row"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <input type="date" className="vd-input vd-input-date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t.vision.dateLabel} />
          <input
            type="number"
            className="vd-input vd-input-num"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isScore ? t.vision.scoreLabel : t.vision.amountLabel}
            step="any"
            min={isScore ? min : undefined}
            max={isScore ? max : undefined}
          />
          <input
            className="vd-input vd-input-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isScore ? t.vision.notePlaceholder : t.vision.noteLabel}
            spellCheck={false}
          />
          <button type="submit" className="vd-add-btn" disabled={!value.trim()}>
            <IconPlus size={14} />
            {isScore ? t.vision.addAttempt : t.vision.addBalance}
          </button>
        </form>
      </div>
      {logs.length > 0 && (
        <AimChart
          logs={logs}
          target={aim.target_value}
          floor={isScore ? min : 0}
          ceil={isScore ? max : Infinity}
          zeroBased={!isScore}
          formatTick={(n) => formatNumber(n, lang)}
          formatXLabel={(d) => formatMonth(d, lang)}
          targetLabel={t.vision.targetLine}
          ariaLabel={`${aim.title}: ${logs.map((l) => fmt(l.value)).join(', ')}`}
        />
      )}
    </div>
  );
}

// ── Cấp bậc: bấm từng phần (学科 / 実技) để đánh dấu đã đậu ──

function LevelEditor({ aim, onSetItems }: Pick<AimDetailProps, 'aim' | 'onSetItems'>) {
  const t = useT();
  const targetIdx = aim.target_value ?? aim.items.length - 1;

  function toggleStep(i: number) {
    onSetItems(aim.items.map((it, j) => (j === i ? { ...it, done: !it.done } : it)));
  }

  function togglePart(i: number, k: number) {
    onSetItems(
      aim.items.map((it, j) =>
        j === i ? { ...it, parts: it.parts.map((p, m) => (m === k ? { ...p, done: !p.done } : p)) } : it
      )
    );
  }

  return (
    <div className="vd-level">
      <div className="vd-head">{t.vision.levelHint}</div>
      <div className="vd-level-steps">
        {aim.items.map((step, i) => {
          const done = stepDone(step);
          return (
            <div key={`${step.name}-${i}`} className={`vd-level-step${done ? ' done' : ''}${i === targetIdx ? ' goal' : ''}`}>
              {step.parts.length ? (
                <>
                  <div className="vd-level-name">{step.name}{done && <IconCheck size={13} stroke={2.5} />}</div>
                  <div className="vd-level-parts">
                    {step.parts.map((p, k) => (
                      <button
                        key={p.name}
                        type="button"
                        className={`vd-part${p.done ? ' on' : ''}`}
                        onClick={() => togglePart(i, k)}
                        aria-pressed={p.done}
                      >
                        {p.done && <IconCheck size={11} stroke={2.5} />}
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <button type="button" className={`vd-part vd-part-step${step.done ? ' on' : ''}`} onClick={() => toggleStep(i)} aria-pressed={step.done}>
                  {step.done && <IconCheck size={12} stroke={2.5} />}
                  {step.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Checklist ──

function ChecklistEditor({ aim, onSetItems }: Pick<AimDetailProps, 'aim' | 'onSetItems'>) {
  const t = useT();
  const [draft, setDraft] = useState('');

  function add() {
    const name = draft.trim();
    if (!name) return;
    onSetItems([...aim.items, { name, done: false, parts: [] }]);
    setDraft('');
  }

  return (
    <div className="vd-check">
      {aim.items.map((it, i) => (
        <div key={`${it.name}-${i}`} className={`vd-check-item${it.done ? ' done' : ''}`}>
          <button
            type="button"
            className="vd-check-box"
            onClick={() => onSetItems(aim.items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            aria-pressed={it.done}
            aria-label={it.name}
          >
            {it.done && <IconCheck size={12} stroke={2.75} />}
          </button>
          <span className="vd-check-name">{it.name}</span>
          <button type="button" className="vd-del" title={t.vision.delete} onClick={() => onSetItems(aim.items.filter((_, j) => j !== i))}>
            <IconX size={13} />
          </button>
        </div>
      ))}
      <form className="vd-check-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <IconPlus size={14} />
        <input className="vd-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.vision.checklistAdd} spellCheck={false} />
      </form>
    </div>
  );
}
