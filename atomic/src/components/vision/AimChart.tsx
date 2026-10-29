import { parseISO } from 'date-fns';
import type { VisionAimLog } from '../../types';
import { niceTicks } from './visionUtils';

interface AimChartProps {
  logs: VisionAimLog[];           // đã sort theo ngày tăng dần
  target: number | null;
  floor: number;                  // amount: 0; score: đáy thang điểm
  ceil: number;                   // score: đỉnh thang điểm; amount: Infinity
  zeroBased: boolean;             // amount luôn tính từ 0
  formatTick: (n: number) => string;
  formatXLabel: (date: string) => string;
  targetLabel: string;
  ariaLabel: string;
}

const W = 320;
const H = 100;
const X0 = 40;
const X1 = 306;
const Y_TOP = 14;
const Y_BOTTOM = 74;
const DAY = 86_400_000;

export default function AimChart({
  logs, target, floor, ceil, zeroBased, formatTick, formatXLabel, targetLabel, ariaLabel,
}: AimChartProps) {
  if (!logs.length) return null;

  const times = logs.map((l) => parseISO(l.date).getTime());
  let tMin = Math.min(...times);
  let tMax = Math.max(...times, Date.now());
  if (tMax - tMin < 60 * DAY) {
    tMin -= 30 * DAY;
    tMax += 30 * DAY;
  }

  const values = logs.map((l) => l.value);
  let lo: number;
  let hi: number;
  if (zeroBased) {
    lo = 0;
    hi = Math.max(target ?? 0, ...values) * 1.08 || 1;
  } else {
    const all = target != null ? [...values, target] : values;
    lo = Math.min(...all);
    hi = Math.max(...all);
    const pad = (hi - lo) * 0.2 || Math.max(1, (ceil - floor) * 0.05);
    lo = Math.max(floor, lo - pad);
    hi = Math.min(ceil, hi + pad);
    if (hi <= lo) hi = lo + 1;
  }

  const x = (t: number) => X0 + ((t - tMin) / (tMax - tMin)) * (X1 - X0);
  const y = (v: number) => Y_BOTTOM - ((v - lo) / (hi - lo)) * (Y_BOTTOM - Y_TOP);

  const yTicks = niceTicks(lo, hi, 3).filter((v) => v >= lo && v <= hi);
  const pts = logs.map((l, i) => ({ x: x(times[i]), y: y(l.value), log: l }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${Y_BOTTOM} L${pts[0].x.toFixed(1)} ${Y_BOTTOM} Z`;
  const showAllValues = logs.length <= 6;
  const targetInRange = target != null && target >= lo && target <= hi;

  // Nhãn trục X: mỗi mốc 1/1 nếu khoảng ≥ 14 tháng, ngược lại chỉ 2 đầu.
  const xLabels: { x: number; text: string; anchor: 'start' | 'middle' | 'end' }[] = [];
  const startYear = new Date(tMin).getFullYear();
  const endYear = new Date(tMax).getFullYear();
  if (tMax - tMin >= 420 * DAY) {
    const step = Math.max(1, Math.ceil((endYear - startYear) / 4));
    for (let yr = startYear + 1; yr <= endYear; yr += step) {
      const px = x(new Date(yr, 0, 1).getTime());
      xLabels.push({ x: px, text: String(yr), anchor: px < X0 + 16 ? 'start' : px > X1 - 16 ? 'end' : 'middle' });
    }
  }
  if (!xLabels.length) {
    xLabels.push({ x: X0, text: formatXLabel(logs[0].date), anchor: 'start' });
    if (logs.length > 1) xLabels.push({ x: X1, text: formatXLabel(logs[logs.length - 1].date), anchor: 'end' });
  }

  return (
    <svg className="vision-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {yTicks.map((v) => (
        <g key={v}>
          <line className="vision-chart-grid" x1={X0} x2={X1} y1={y(v)} y2={y(v)} />
          <text className="vision-chart-axis" x={X0 - 6} y={y(v) + 3.2} textAnchor="end">{formatTick(v)}</text>
        </g>
      ))}
      {targetInRange && (
        <>
          <line className="vision-chart-target" x1={X0} x2={X1} y1={y(target!)} y2={y(target!)} />
          <text className="vision-chart-tlabel" x={X1} y={y(target!) - 4} textAnchor="end">{targetLabel}</text>
        </>
      )}
      <path className="vision-chart-area" d={area} />
      <path className="vision-chart-line" d={line} />
      {pts.map((p, i) => (
        <circle
          key={p.log.id}
          className={`vision-chart-dot${i === pts.length - 1 ? ' last' : ''}`}
          cx={p.x}
          cy={p.y}
          r={i === pts.length - 1 ? 3.6 : 3.2}
        />
      ))}
      {pts.map((p, i) =>
        showAllValues || i === pts.length - 1 ? (
          <text key={`v${p.log.id}`} className="vision-chart-val" x={p.x} y={p.y - 7} textAnchor="middle">
            {formatTick(p.log.value)}
          </text>
        ) : null
      )}
      {xLabels.map((l) => (
        <text key={l.text} className="vision-chart-axis" x={l.x} y={H - 6} textAnchor={l.anchor}>{l.text}</text>
      ))}
    </svg>
  );
}
