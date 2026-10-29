import { Fragment } from 'react';
import { IconCheck } from '@tabler/icons-react';
import type { Language, VisionAim, VisionAimLog } from '../../types';
import { useT } from '../../i18n';
import { bandOf, bestLog, formatAmount, formatNumber, getPreset, latestLog, scaleOf, stepDone } from './visionUtils';

interface AimMeasureProps {
  aim: VisionAim;
  logs: VisionAimLog[];
  lang: Language;
}

const pct = (v: number) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(2)}%`;

export default function AimMeasure({ aim, logs, lang }: AimMeasureProps) {
  const t = useT();

  if (aim.kind === 'score') {
    const best = bestLog(logs);
    const { min, max } = scaleOf(aim);
    const preset = getPreset(aim.preset);
    const target = aim.target_value;
    const value = (
      <div className="vm-val">
        <b>{best ? formatNumber(best.value, lang) : '—'}</b>
        {target != null && <span>/ {formatNumber(target, lang)}+</span>}
      </div>
    );

    if (preset?.bands) {
      const bands = preset.bands;
      const cur = best ? bandOf(preset, best.value) : -1;
      const goal = target != null ? bandOf(preset, target) : -1;
      return (
        <div className="vm">
          {value}
          <div className="vm-bands">
            {bands.map((b, i) => {
              const to = bands[i + 1]?.from ?? max;
              const cls = [i === goal && 'goal', i === cur && 'cur', i < cur && 'past'].filter(Boolean).join(' ');
              return (
                <span key={b.label} className={cls} style={{ flex: to - b.from }}>
                  {b.label}
                </span>
              );
            })}
            {best && <i className="vm-marker" style={{ left: pct((best.value - min) / (max - min)) }} />}
          </div>
        </div>
      );
    }

    return (
      <div className="vm">
        {value}
        <div className="vm-track">
          {best && <div className="vm-fill" style={{ width: pct((best.value - min) / (max - min)) }} />}
          {target != null && <span className="vm-target" style={{ left: pct((target - min) / (max - min)) }} />}
        </div>
        <div className="vm-ticks">
          <span>{formatNumber(min, lang)}</span>
          <span>{formatNumber(max, lang)}</span>
        </div>
      </div>
    );
  }

  if (aim.kind === 'amount') {
    const latest = latestLog(logs);
    const target = aim.target_value ?? 0;
    const ticks = target > 0 ? [0, 1, 2, 3, 4, 5].map((i) => (target * i) / 5) : [];
    return (
      <div className="vm">
        <div className="vm-val">
          <b>{latest ? formatAmount(latest.value, null, lang) : '—'}</b>
          <span>/ {formatAmount(target, aim.unit, lang)}</span>
        </div>
        <div className="vm-track">
          {latest && target > 0 && <div className="vm-fill" style={{ width: pct(latest.value / target) }} />}
        </div>
        {ticks.length > 0 && (
          <div className="vm-ticks">
            {ticks.map((v) => <span key={v}>{formatNumber(v, lang, 0)}</span>)}
          </div>
        )}
      </div>
    );
  }

  if (aim.kind === 'level') {
    const targetIdx = aim.target_value ?? aim.items.length - 1;
    return (
      <div className="vm">
        <div className="vm-ladder">
          {aim.items.map((step, i) => {
            const done = stepDone(step);
            const cls = done ? 'done' : i === targetIdx ? 'goal' : i > targetIdx ? 'dim' : '';
            return (
              <Fragment key={`${step.name}-${i}`}>
                {i > 0 && <span className="vm-link" />}
                <span className={`vm-step ${cls}`}>
                  <span className="vm-step-name">
                    {step.name}
                    {done && <IconCheck size={11} stroke={2.5} />}
                  </span>
                  {i === targetIdx && !done && step.parts.length > 0 && (
                    <small>
                      {step.parts.map((p, j) => (
                        <Fragment key={p.name}>
                          {j > 0 && ' · '}
                          {p.done ? <b>{p.name} ✓</b> : p.name}
                        </Fragment>
                      ))}
                    </small>
                  )}
                </span>
              </Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // checklist
  if (aim.items.length) {
    const done = aim.items.filter((it) => it.done).length;
    return (
      <div className="vm">
        <div className="vm-val">
          <b>{done}</b>
          <span>/ {t.vision.partsTotal(aim.items.length)}</span>
        </div>
        <div className="vm-pips">
          {aim.items.map((it, i) => <i key={i} className={it.done ? 'on' : ''} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="vm">
      <div className="vm-val"><span>{t.vision.binary}</span></div>
      <div className={`vm-binary${aim.status === 'achieved' ? ' on' : ''}`} />
    </div>
  );
}
