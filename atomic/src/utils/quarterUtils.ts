import type { Quarter } from "../types";

const QUARTER_ORDER: Quarter[] = ["Q1", "Q2", "Q3", "Q4", "full"];

export function sortQuarters(quarters: Quarter[]): Quarter[] {
  return [...quarters].sort((a, b) => QUARTER_ORDER.indexOf(a) - QUARTER_ORDER.indexOf(b));
}

export function quartersToDb(quarters: Quarter[]): string {
  return sortQuarters(quarters).join(",");
}

export function quartersFromDb(value: string): Quarter[] {
  return value ? (value.split(",") as Quarter[]) : [];
}

/** Gộp quý liền nhau thành khoảng ("III – IV"), quý rời rạc thì liệt kê ("I, III"). Không xử lý 'full'. */
export function quarterSpan(quarters: Quarter[], label: (q: Exclude<Quarter, "full">) => string): string {
  const qs = sortQuarters(quarters).filter((q): q is Exclude<Quarter, "full"> => q !== "full");
  const contiguous =
    qs.length > 1 && qs.every((q, i) => i === 0 || QUARTER_ORDER.indexOf(q) === QUARTER_ORDER.indexOf(qs[i - 1]) + 1);
  return contiguous ? `${label(qs[0])} – ${label(qs[qs.length - 1])}` : qs.map(label).join(", ");
}
