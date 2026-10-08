// Validasi kelengkapan publish (spec §6.6) — fungsi murni, tanpa I/O.
// Dipakai dialog publish admin (Task 7+): hasil MissingField[] memberi tahu
// field apa saja yang kurang, dengan label Bahasa Indonesia dan nama field
// yang persis nama field form (plan Task 3).

import type {
  EventRecord,
  MajelisRecord,
  RecurrencePattern,
  RoutineRecord,
  Weekday,
} from "./domain.ts";

export type MissingField = { field: string; label: string };

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}

function isValidWeekday(value: unknown): value is Weekday {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

/** Pola lengkap sesuai kind-nya (plan Task 3 Interfaces). */
function isPatternComplete(pattern: RecurrencePattern | undefined): boolean {
  if (pattern == null) return false;
  switch (pattern.kind) {
    case "weekly":
      return isValidWeekday(pattern.weekday);
    case "monthly-date":
      return (
        typeof pattern.dayOfMonth === "number" &&
        Number.isInteger(pattern.dayOfMonth) &&
        pattern.dayOfMonth >= 1 &&
        pattern.dayOfMonth <= 31
      );
    case "monthly-weekday":
      return (
        isValidWeekday(pattern.weekday) &&
        (pattern.weekOfMonth === "last" ||
          (typeof pattern.weekOfMonth === "number" &&
            Number.isInteger(pattern.weekOfMonth) &&
            pattern.weekOfMonth >= 1 &&
            pattern.weekOfMonth <= 5))
      );
    default:
      return false;
  }
}

type ScheduleShape = Partial<
  Pick<
    EventRecord,
    | "title"
    | "category"
    | "startTime"
    | "venueName"
    | "address"
    | "city"
    | "district"
  >
>;

/**
 * Field tampilan wajib yang sama untuk Event & Jadwal Rutin, dalam urutan
 * spec §6.2 dengan sisipan `dateOrPattern` di posisi tanggal/pola.
 */
function validateScheduleCommon(
  s: ScheduleShape,
  dateOrPattern: MissingField | null,
): MissingField[] {
  const missing: MissingField[] = [];
  if (isBlank(s.title)) missing.push({ field: "title", label: "Judul" });
  if (s.category == null)
    missing.push({ field: "category", label: "Kategori" });
  if (dateOrPattern) missing.push(dateOrPattern);
  if (isBlank(s.startTime))
    missing.push({ field: "startTime", label: "Jam mulai" });
  if (isBlank(s.venueName))
    missing.push({ field: "venueName", label: "Nama tempat" });
  if (isBlank(s.address))
    missing.push({ field: "address", label: "Alamat lengkap" });
  if (isBlank(s.city))
    missing.push({ field: "city", label: "Kota/Kabupaten" });
  if (isBlank(s.district))
    missing.push({ field: "district", label: "Kecamatan" });
  return missing;
}

/** 8 field wajib publish Event (spec §6.6). [] = boleh publish. */
export function validateEventForPublish(
  e: Partial<EventRecord>,
): MissingField[] {
  return validateScheduleCommon(
    e,
    isBlank(e.startDate)
      ? { field: "startDate", label: "Tanggal mulai" }
      : null,
  );
}

/** Field wajib publish Jadwal Rutin: tanggal diganti kelengkapan pola. */
export function validateRoutineForPublish(
  r: Partial<RoutineRecord>,
): MissingField[] {
  return validateScheduleCommon(
    r,
    isPatternComplete(r.pattern)
      ? null
      : { field: "pattern", label: "Pola pengulangan" },
  );
}

/** Field wajib publish profil Majelis: nama + kota/kabupaten basis. */
export function validateMajelisForPublish(
  m: Partial<MajelisRecord>,
): MissingField[] {
  const missing: MissingField[] = [];
  if (isBlank(m.name)) missing.push({ field: "name", label: "Nama majelis" });
  if (isBlank(m.city))
    missing.push({ field: "majelisCity", label: "Kota/Kabupaten basis" });
  return missing;
}
