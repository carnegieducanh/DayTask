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
