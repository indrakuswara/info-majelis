// Penyusunan pola domain dari potongan form Jadwal Rutin (plan
// Task 10). Dipakai bersama oleh RoutineForm (klien: validasi &
// pratinjau kemunculan live) dan actions rutin (server: penyimpanan &
// gerbang publish) agar hanya ada SATU pemetaan form → pola.
//
// Bagian pola yang belum dipilih menjadi nilai penanda yang sengaja
// tidak valid (weekday -1 / dayOfMonth 0): pola tersimpan pada draft
// tetap terbaca "belum lengkap" oleh validateRoutineForPublish, dan
// computeOccurrences tidak pernah mencocokkan penanda — tidak ada
// representasi pola kedua di luar tipe domain (domain.ts).

import type { RecurrencePattern, Weekday } from "../../lib/domain.ts";

export type PatternKind = "weekly" | "monthly-date" | "monthly-weekday";

export interface PatternFormParts {
  patternKind: PatternKind;
  /** weekday pola mingguan; null = belum dipilih (penanda). */
  weeklyWeekday: number | null;
  /** tanggal pola bulanan tanggal tetap; null = belum diisi (penanda). */
  monthlyDayOfMonth: number | null;
  /** weekday pola bulanan minggu-ke; null = belum dipilih (penanda). */
  monthlyWeekday: number | null;
  /** "1".."5" | "last" | "" (belum dipilih). */
  monthlyWeekOfMonth: string;
}

/** Penanda weekday belum dipilih — tidak pernah lolos validasi pola. */
export const PLACEHOLDER_WEEKDAY = -1;
/** Penanda tanggal bulanan belum diisi — di luar rentang sah 1–31. */
export const PLACEHOLDER_DAY_OF_MONTH = 0;

export function buildPatternFromParts(
  parts: PatternFormParts,
): RecurrencePattern {
  switch (parts.patternKind) {
    case "monthly-date":
      return {
        kind: "monthly-date",
        dayOfMonth: parts.monthlyDayOfMonth ?? PLACEHOLDER_DAY_OF_MONTH,
      };
    case "monthly-weekday": {
      const weekOfMonth =
        parts.monthlyWeekOfMonth === "last"
          ? "last"
          : [1, 2, 3, 4, 5].includes(Number(parts.monthlyWeekOfMonth))
            ? (Number(parts.monthlyWeekOfMonth) as 1 | 2 | 3 | 4 | 5)
            : 1;
      return {
        kind: "monthly-weekday",
        weekday: (parts.monthlyWeekday ?? PLACEHOLDER_WEEKDAY) as Weekday,
        weekOfMonth,
      };
    }
    default:
      return {
        kind: "weekly",
        weekday: (parts.weeklyWeekday ?? PLACEHOLDER_WEEKDAY) as Weekday,
      };
  }
}

/** Potongan form dari pola tersimpan; penanda dipetakan kembali ke kosong. */
export function patternPartsFromPattern(
  pattern: RecurrencePattern,
): PatternFormParts {
  const validWeekday = (value: number): number | null =>
    Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
  switch (pattern.kind) {
    case "monthly-date":
      return {
        patternKind: "monthly-date",
        weeklyWeekday: null,
        monthlyDayOfMonth:
          pattern.dayOfMonth >= 1 && pattern.dayOfMonth <= 31
            ? pattern.dayOfMonth
            : null,
        monthlyWeekday: null,
        monthlyWeekOfMonth: "",
      };
    case "monthly-weekday":
      return {
        patternKind: "monthly-weekday",
        weeklyWeekday: null,
        monthlyDayOfMonth: null,
        monthlyWeekday: validWeekday(pattern.weekday),
        monthlyWeekOfMonth: String(pattern.weekOfMonth),
      };
    default:
      return {
        patternKind: "weekly",
        weeklyWeekday: validWeekday(pattern.weekday),
        monthlyDayOfMonth: null,
        monthlyWeekday: null,
        monthlyWeekOfMonth: "",
      };
  }
}
