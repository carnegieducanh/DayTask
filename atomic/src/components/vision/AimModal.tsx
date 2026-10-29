import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AimItem, AimKind, Category, CategoryColors, NewVisionAim, Vision, VisionAim } from '../../types';
import { useT } from '../../i18n';
import { useModalClose } from '../../hooks/useModalClose';
import { SCORE_PRESETS, getPreset, splitList } from './visionUtils';

interface AimModalProps {
  vision: Vision;
  initial?: VisionAim;
  categoryColors: CategoryColors;
  onSave: (data: NewVisionAim) => Promise<void>;
  onClose: () => void;
}

const KINDS: AimKind[] = ['score', 'level', 'amount', 'checklist'];
const CATEGORIES: Category[] = ['learn', 'finance', 'work', 'health', 'personal', 'creative', 'mindfulness', 'other'];

const numOrNull = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

export default function AimModal({ vision, initial, categoryColors, onSave, onClose }: AimModalProps) {
  const t = useT();
  const overlayHandlers = useModalClose(onClose);
  const is = (k: AimKind) => initial?.kind === k;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'learn');
  const [kind, setKind] = useState<AimKind>(initial?.kind ?? 'score');
  const [preset, setPreset] = useState(is('score') ? initial!.preset ?? 'custom' : 'toeic');
  const [scaleMin, setScaleMin] = useState(is('score') && initial!.scale_min != null ? String(initial!.scale_min) : '0');
  const [scaleMax, setScaleMax] = useState(is('score') && initial!.scale_max != null ? String(initial!.scale_max) : '100');
  const [target, setTarget] = useState(
    (is('score') || is('amount')) && initial!.target_value != null ? String(initial!.target_value) : ''
  );
  const [unit, setUnit] = useState(is('amount') ? initial!.unit ?? '' : '万円');
  const [levelsText, setLevelsText] = useState(is('level') ? initial!.items.map((it) => it.name).join(', ') : '');
  const [partsText, setPartsText] = useState(
    is('level') ? (initial!.items[0]?.parts ?? []).map((p) => p.name).join(', ') : ''
  );
  const [targetLevel, setTargetLevel] = useState(is('level') ? initial!.target_value ?? 0 : 0);
  const [checklistText, setChecklistText] = useState(is('checklist') ? initial!.items.map((it) => it.name).join('\n') : '');
  const [nextStep, setNextStep] = useState(initial?.next_step ?? '');
  const [nextDate, setNextDate] = useState(initial?.next_date ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const levels = splitList(levelsText);
  const safeTargetLevel = Math.min(targetLevel, Math.max(0, levels.length - 1));
  const valid =
    !!title.trim() &&
    (kind === 'score' ? numOrNull(target) != null && (preset !== 'custom' || (numOrNull(scaleMin) ?? 0) < (numOrNull(scaleMax) ?? 0)) : true) &&
    (kind === 'amount' ? (numOrNull(target) ?? 0) > 0 : true) &&
    (kind === 'level' ? levels.length > 0 : true);

  // Đổi tên/thêm bớt bậc hay phần: giữ trạng thái đã đậu của những tên còn giữ nguyên
  function buildItems(): AimItem[] {
    const prev = initial?.items ?? [];
    if (kind === 'level') {
      const parts = splitList(partsText);
      return levels.map((name) => {
        const old = prev.find((it) => it.name === name);
        return {
          name,
          done: old?.done ?? false,
          parts: parts.map((p) => ({ name: p, done: old?.parts.find((x) => x.name === p)?.done ?? false })),
        };
      });
    }
    if (kind === 'checklist') {
      return splitList(checklistText, /\n/).map((name) => ({
        name,
        done: prev.find((it) => it.name === name)?.done ?? false,
        parts: [],
      }));
    }
    return [];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const scorePreset = kind === 'score' ? getPreset(preset) : undefined;
    await onSave({
      vision_id: vision.id,
      title: title.trim(),
      category,
      kind,
      preset: scorePreset ? scorePreset.id : null,
      scale_min: kind === 'score' ? scorePreset?.min ?? numOrNull(scaleMin) : null,
      scale_max: kind === 'score' ? scorePreset?.max ?? numOrNull(scaleMax) : null,
      target_value: kind === 'level' ? safeTargetLevel : kind === 'checklist' ? null : numOrNull(target),
      unit: kind === 'amount' ? unit.trim() || null : null,
      items: buildItems(),
      status: initial?.status ?? 'in_progress',
      next_step: nextStep.trim() || null,
      next_date: nextDate || null,
    });
    setSaving(false);
  }

  return createPortal(
    <div className="modal-overlay" {...overlayHandlers}>
      <div className="modal vision-modal vision-aim-modal">
        <div className="modal-title">{initial ? t.vision.aimModalEdit : t.vision.aimModalAdd}</div>
        <div className="vision-modal-sub">{t.vision.aimModalSub(vision.title)}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="aim-title">{t.vision.aimTitleLabel}</label>
            <input
              id="aim-title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.vision.aimTitlePlaceholder}
              spellCheck={false}
              autoFocus
            />
          </div>

          <div className="form-group">
            <span className="form-label">{t.vision.categoryLabel}</span>
            <div className="vision-chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`vision-chip${category === c ? ' sel' : ''}`}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                >
                  <span className="cat-color-dot" style={{ background: categoryColors[c] }} />
                  {t.cat[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <span className="form-label">{t.vision.kindLabel}</span>
            <div className="vision-seg">
              {KINDS.map((k) => (
                <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)} aria-pressed={kind === k}>
                  {t.vision.kinds[k]}
                </button>
              ))}
            </div>
            <div className="vision-form-hint vision-kind-hint">{t.vision.kindHints[kind]}</div>
          </div>

          {kind === 'score' && (
            <>
              <div className="form-group">
                <span className="form-label">{t.vision.presetLabel}</span>
                <div className="vision-chips">
                  {SCORE_PRESETS.map((p) => (
                    <button key={p.id} type="button" className={`vision-chip${preset === p.id ? ' sel' : ''}`} onClick={() => setPreset(p.id)}>
                      {p.label}
                      <span className="vision-chip-sub">{p.min}–{p.max}</span>
                    </button>
                  ))}
                  <button type="button" className={`vision-chip${preset === 'custom' ? ' sel' : ''}`} onClick={() => setPreset('custom')}>
                    {t.vision.presetCustom}
                  </button>
                </div>
              </div>
              <div className={preset === 'custom' ? 'vision-form-row3' : 'vision-form-row1'}>
                {preset === 'custom' && (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor="aim-min">{t.vision.scaleFrom}</label>
                      <input id="aim-min" className="form-input" type="number" step="any" value={scaleMin} onChange={(e) => setScaleMin(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="aim-max">{t.vision.scaleTo}</label>
                      <input id="aim-max" className="form-input" type="number" step="any" value={scaleMax} onChange={(e) => setScaleMax(e.target.value)} />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="aim-target">{t.vision.targetLabel}</label>
                  <input id="aim-target" className="form-input" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {kind === 'amount' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="aim-amount">{t.vision.amountTargetLabel}</label>
                <input id="aim-amount" className="form-input" type="number" step="any" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="aim-unit">{t.vision.unitLabel}</label>
                <input id="aim-unit" className="form-input" value={unit} onChange={(e) => setUnit(e.target.value)} spellCheck={false} />
              </div>
            </div>
          )}

          {kind === 'level' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="aim-levels">{t.vision.levelsLabel}</label>
                <input id="aim-levels" className="form-input vision-jp" value={levelsText} onChange={(e) => setLevelsText(e.target.value)} placeholder={t.vision.levelsPlaceholder} spellCheck={false} />
                <div className="vision-form-hint">{t.vision.commaHint}</div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="aim-target-level">{t.vision.targetLevelLabel}</label>
                  <select
                    id="aim-target-level"
                    className="form-input vision-jp"
                    value={safeTargetLevel}
                    onChange={(e) => setTargetLevel(Number(e.target.value))}
                    disabled={!levels.length}
                  >
                    {levels.map((name, i) => <option key={`${name}-${i}`} value={i}>{name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="aim-parts">{t.vision.partsLabel}</label>
                  <input id="aim-parts" className="form-input vision-jp" value={partsText} onChange={(e) => setPartsText(e.target.value)} placeholder={t.vision.partsPlaceholder} spellCheck={false} />
                </div>
              </div>
            </>
          )}

          {kind === 'checklist' && (
            <div className="form-group">
              <label className="form-label" htmlFor="aim-checklist">{t.vision.checklistLabel}</label>
              <textarea id="aim-checklist" className="form-input vision-checklist-input" value={checklistText} onChange={(e) => setChecklistText(e.target.value)} rows={4} spellCheck={false} />
            </div>
          )}

          <div className="vision-form-row-next">
            <div className="form-group">
              <label className="form-label" htmlFor="aim-next">{t.vision.nextStepLabel}</label>
              <input id="aim-next" className="form-input" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder={t.vision.nextStepPlaceholder} spellCheck={false} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aim-next-date">{t.vision.nextDateLabel}</label>
              <input id="aim-next-date" className="form-input" type="month" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t.vision.cancel}</button>
            <button type="submit" className="btn btn-primary" disabled={!valid || saving}>{t.vision.save}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
