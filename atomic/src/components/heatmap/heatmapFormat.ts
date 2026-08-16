export function fmtMinutes(minutes: number): string {
  if (minutes <= 0) return '0p';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}g${m}p`;
  if (h > 0) return `${h}g`;
  return `${m}p`;
}

export function fmtHoursFloat(minutes: number): string {
  return (minutes / 60).toFixed(1);
}
