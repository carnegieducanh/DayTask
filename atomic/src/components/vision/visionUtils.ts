import {
  parseISO,
  format,
  differenceInCalendarDays,
  differenceInMonths,
  differenceInYears,
  intervalToDuration,
} from 'date-fns';
import type { AimItem, Category, Language, VisionAim, VisionAimLog } from '../../types';

// ── Thang điểm có sẵn ──
// BJT chia band theo bảng điểm chính thức (J5 0–199 … J1+ 600–800) để cột đo vẽ đúng band.

export interface ScoreBand {
  label: string;
  from: number;
}

export interface ScorePreset {
  id: string;
  label: string;
  min: number;
  max: number;
  bands?: ScoreBand[];
}

export const SCORE_PRESETS: ScorePreset[] = [
  { id: 'toeic', label: 'TOEIC L&R', min: 10, max: 990 },
  {
    id: 'bjt',
    label: 'BJT',
    min: 0,
    max: 800,
    bands: [
      { label: 'J5', from: 0 },
      { label: 'J4', from: 200 },
      { label: 'J3', from: 320 },
      { label: 'J2', from: 420 },
      { label: 'J1', from: 530 },
      { label: 'J1+', from: 600 },
    ],
  },
  { id: 'ielts', label: 'IELTS', min: 0, max: 9 },
];

export function getPreset(id: string | null): ScorePreset | undefined {
  return id ? SCORE_PRESETS.find((p) => p.id === id) : undefined;
}

export function scaleOf(aim: VisionAim): { min: number; max: number } {
  const preset = getPreset(aim.preset);
  if (preset) return { min: preset.min, max: preset.max };
  return { min: aim.scale_min ?? 0, max: aim.scale_max ?? Math.max(100, aim.target_value ?? 100) };
}

export function bandOf(preset: ScorePreset, value: number): number {
  const bands = preset.bands ?? [];
  let idx = -1;
  bands.forEach((b, i) => {
    if (value >= b.from) idx = i;
  });
  return idx;
}

// ── Tiến độ ──

export function stepDone(item: AimItem): boolean {
  return item.parts.length ? item.parts.every((p) => p.done) : item.done;
}

export function logsOf(aimId: number, logs: VisionAimLog[]): VisionAimLog[] {
  return logs
    .filter((l) => l.aim_id === aimId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

export function bestLog(logs: VisionAimLog[]): VisionAimLog | null {
  return logs.reduce<VisionAimLog | null>((best, l) => (!best || l.value > best.value ? l : best), null);
}

export function latestLog(logs: VisionAimLog[]): VisionAimLog | null {
  return logs.length ? logs[logs.length - 1] : null;
}

/** Đã chạm mục tiêu theo dữ liệu (chưa chắc đã được đóng dấu). */
export function isReached(aim: VisionAim, logs: VisionAimLog[]): boolean {
  switch (aim.kind) {
    case 'score': {
      const best = bestLog(logs);
      return !!best && aim.target_value != null && best.value >= aim.target_value;
    }
    case 'amount': {
      const latest = latestLog(logs);
      return !!latest && aim.target_value != null && latest.value >= aim.target_value;
    }
    case 'level': {
      const target = aim.items[aim.target_value ?? -1];
      return !!target && stepDone(target);
    }
    case 'checklist':
      return aim.items.length > 0 && aim.items.every((it) => it.done);
  }
}

/** Có tiến triển nào chưa — dùng để tự chuyển "Chưa bắt đầu" → "Đang theo đuổi". */
export function hasProgress(aim: VisionAim, logs: VisionAimLog[]): boolean {
  if (logs.length) return true;
  return aim.items.some((it) => it.done || it.parts.some((p) => p.done));
}

// ── Nhóm theo danh mục, giữ thứ tự người dùng nhập ──

export function groupAims(aims: VisionAim[]): { category: Category; aims: VisionAim[] }[] {
  const groups: { category: Category; aims: VisionAim[] }[] = [];
  for (const aim of [...aims].sort((a, b) => a.position - b.position || a.id - b.id)) {
    const g = groups.find((x) => x.category === aim.category);
    if (g) g.aims.push(aim);
    else groups.push({ category: aim.category, aims: [aim] });
  }
  return groups;
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [v, s] of map) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

// ── Ngày tháng ──

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDay(date: string, lang: Language): string {
  const d = parseISO(date);
  return lang === 'vi' ? format(d, 'dd.MM.yyyy') : format(d, 'MMM d, yyyy');
}

/** Nhận 'YYYY-MM' hoặc 'YYYY-MM-DD'. */
export function formatMonth(date: string, lang: Language): string {
  const d = parseISO(date.length === 7 ? `${date}-01` : date);
  return lang === 'vi' ? format(d, 'MM.yyyy') : format(d, 'MMM yyyy');
}

export function daysUntil(date: string, today: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

export function spanParts(from: string, to: string): { years: number; months: number; days: number } {
  const d = intervalToDuration({ start: parseISO(from), end: parseISO(to) });
  return { years: d.years ?? 0, months: d.months ?? 0, days: d.days ?? 0 };
}

export function monthsBetween(from: string, to: string): number {
  return differenceInMonths(parseISO(to), parseISO(from));
}

export function elapsedFraction(start: string, target: string, today: string): number {
  const total = differenceInCalendarDays(parseISO(target), parseISO(start));
  if (total <= 0) return 1;
  const done = differenceInCalendarDays(parseISO(today), parseISO(start));
  return Math.min(1, Math.max(0, done / total));
}

export function ageOn(birthDate: string, date: string): number {
  return differenceInYears(parseISO(date), parseISO(birthDate));
}

/** Sinh nhật tròn `age` tuổi. 29/02 rơi vào năm không nhuận thì date-fns tự lùi về 28/02. */
export function birthdayAt(birthDate: string, age: number): string {
  const b = parseISO(birthDate);
  const d = new Date(b.getFullYear() + age, b.getMonth(), b.getDate());
  if (d.getMonth() !== b.getMonth()) d.setDate(0);
  return format(d, 'yyyy-MM-dd');
}

// ── Số ──

export function formatNumber(n: number, lang: Language, maxFraction = 1): string {
  return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: maxFraction }).format(n);
}

/** "210万円", "1.500 USD": đơn vị bắt đầu bằng chữ cái thì cách 1 khoảng trắng, ký hiệu (万円, ¥, $) thì viết liền. */
export function formatAmount(n: number, unit: string | null, lang: Language): string {
  const num = formatNumber(n, lang);
  if (!unit) return num;
  return /^[A-Za-zÀ-ỹ]/.test(unit) ? `${num} ${unit}` : `${num}${unit}`;
}

/** Bước tròn (1/2/5 × 10^k) cho các vạch trục. */
export function niceTicks(lo: number, hi: number, count = 3): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export function splitList(input: string, separator: RegExp = /[,、，\n]/): string[] {
  return input
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}
