import { format, isSameMonth, isSameYear } from 'date-fns';
import type { Locale } from 'date-fns';

export function fmtMinutes(minutes: number, hourUnit: string, minuteUnit: string): string {
  if (minutes <= 0) return `0${minuteUnit}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}${hourUnit}${m}${minuteUnit}`;
  if (h > 0) return `${h}${hourUnit}`;
  return `${m}${minuteUnit}`;
}

export function fmtHoursFloat(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export function fmtDateRange(start: Date, end: Date, locale?: Locale): string {
  const full = "d MMM',' yyyy";
  const short = 'd MMM';
  if (isSameMonth(start, end)) {
    return `${format(start, 'd', { locale })} – ${format(end, full, { locale })}`;
  }
  if (isSameYear(start, end)) {
    return `${format(start, short, { locale })} – ${format(end, full, { locale })}`;
  }
  return `${format(start, full, { locale })} – ${format(end, full, { locale })}`;
}
