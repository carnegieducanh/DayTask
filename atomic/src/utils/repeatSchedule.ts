// Lịch lặp của 1 chuỗi task: những thứ nào trong tuần, mỗi thứ mấy giờ.
// Lưu ở cột tasks.repeat_days của template dạng JSON; NULL = mỗi ngày, không đặt giờ
// (đúng hành vi "Lặp lại hàng ngày" trước khi có lịch theo thứ).

export interface RepeatSlot {
  day: number;           // 0 = Chủ nhật … 6 = Thứ bảy (giống Date.getDay())
  start: string | null;  // 'HH:MM' — null = không đặt giờ → instance nằm ở khay "Chờ xếp lịch"
  end: string | null;
}

const TIME_RE = /^\d{2}:\d{2}$/;

export function weekdayOf(date: string): number {
  return new Date(date + 'T00:00:00').getDay();
}

/** null = mỗi ngày không giờ (kể cả khi JSON hỏng — rơi về hành vi cũ thay vì mất chuỗi). */
export function parseRepeatDays(raw: string | null | undefined): RepeatSlot[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const slots: RepeatSlot[] = [];
    for (const item of parsed) {
      const day = Number((item as RepeatSlot)?.day);
      if (!Number.isInteger(day) || day < 0 || day > 6 || slots.some((s) => s.day === day)) continue;
      const start = (item as RepeatSlot).start;
      const end = (item as RepeatSlot).end;
      const timed = typeof start === 'string' && typeof end === 'string' && TIME_RE.test(start) && TIME_RE.test(end);
      slots.push({ day, start: timed ? start : null, end: timed ? end : null });
    }
    return slots.length ? slots.sort((a, b) => a.day - b.day) : null;
  } catch {
    return null;
  }
}

/**
 * Không chọn thứ nào, hoặc đủ 7 ngày mà không ngày nào có giờ ≡ NULL (mỗi ngày, không giờ)
 * — chuỗi "hằng ngày" cũ không bị đổi dạng khi lưu lại.
 */
export function serializeRepeatDays(slots: RepeatSlot[]): string | null {
  const sorted = [...slots].sort((a, b) => a.day - b.day);
  if (sorted.length === 0) return null;
  if (sorted.length === 7 && sorted.every((s) => !s.start && !s.end)) return null;
  return JSON.stringify(
    sorted.map((s) => ({ day: s.day, start: s.start || null, end: s.end || null })),
  );
}

/** Các thứ hiện là đã chọn trong modal. NULL (mỗi ngày, không giờ) → chưa chọn thứ nào. */
export function editorRepeatSlots(raw: string | null | undefined): RepeatSlot[] {
  return parseRepeatDays(raw) ?? [];
}

/** Slot của chuỗi vào ngày `date`; undefined = chuỗi không lặp vào thứ đó. */
export function repeatSlotOn(raw: string | null | undefined, date: string): RepeatSlot | undefined {
  const day = weekdayOf(date);
  const slots = parseRepeatDays(raw);
  if (!slots) return { day, start: null, end: null };
  return slots.find((s) => s.day === day);
}
