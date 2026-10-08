// Mesin recurrence jadwal rutin (plan Task 2; spec §6.3–§6.4 & §13.2).
//
// Fungsi MURNI tanpa I/O. Semua perhitungan dilakukan sebagai tanggal/jam
// dinding WIB (Asia/Jakarta): string tanggal "YYYY-MM-DD" dan jam "HH:mm"
// diperlakukan apa adanya sebagai komponen kalender, lalu diubah ke cap
// waktu sintetis lewat Date.UTC + getter UTC semata-mata sebagai alat
// aritmetika — zona waktu mesin tidak pernah ikut menggeser hari.
//
// Aturan inti:
// - Kemunculan yang sudah selesai pada waktu acuan tidak dikembalikan;
//   yang sedang berjalan dikembalikan dengan isOngoing = true.
// - endTime < startTime berarti selesai keesokan hari; endTime null berarti
//   berlangsung sampai 23:59 hari yang sama.
// - Pengecualian `libur`: default dilewati & tidak dihitung ke count;
//   dengan opts.includeSkipped ikut dikembalikan (bertanda) & dihitung.
// - Pengecualian `edisi-spesial`: memakai override tempat/alamat/jam mulai.
// - Bila satu tanggal punya libur DAN edisi spesial, edisi spesial menang
//   (spec §13.2); idealnya data hanya punya satu pengecualian per tanggal.
// - monthly-date 29/30/31 pada bulan yang tidak memilikinya dilewati
//   (bukan digeser); monthly-weekday minggu ke-5 yang tidak ada juga
//   dilewati ke bulan berikutnya.

import type {
  Occurrence,
  RoutineExceptionRecord,
  RoutineRecord,
} from "./domain.ts";

type RoutineInput = Pick<
  RoutineRecord,
  | "pattern"
  | "startTime"
  | "endTime"
  | "effectiveFrom"
  | "effectiveTo"
  | "venueName"
  | "address"
>;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
/** Batas aman pemindaian: ±10 tahun kalender dari titik awal pindai. */
const MAX_SCAN_DAYS = 366 * 10;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Cap waktu sintetis dari komponen kalender WIB (alat hitung saja). */
function wallTs(
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
): number {
  return Date.UTC(year, month - 1, day, hour, minute);
}

/** "YYYY-MM-DD" dari cap waktu sintetis. */
function dateOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** ISO datetime WIB ("YYYY-MM-DDTHH:mm:00+07:00") dari cap waktu sintetis. */
function isoOf(ts: number): string {
  const d = new Date(ts);
  return `${dateOf(ts)}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00+07:00`;
}

/**
 * Parse fromISO menjadi cap waktu sintetis. Komponen tanggal/jam pada
 * string diperlakukan sebagai waktu dinding WIB apa adanya (suffix zona
 * diabaikan — kontrak plan: fromISO selalu datetime WIB). String tanggal
 * saja ("YYYY-MM-DD") diterima sebagai pukul 00:00.
 */
function parseFromISO(fromISO: string): number {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
      fromISO.trim(),
    );
  if (!m) {
    throw new Error(`fromISO tidak valid: ${fromISO}`);
  }
  const [, y, mo, d, hh = "0", mm = "0", ss = "0"] = m;
  return (
    wallTs(Number(y), Number(mo), Number(d), Number(hh), Number(mm)) +
    Number(ss) * 1000
  );
}

/** "HH:mm" → menit sejak 00:00. */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/** Apakah tanggal (cap waktu tengah malam sintetis) cocok dengan pola? */
function matchesPattern(
  routine: RoutineInput,
  dayTs: number,
): boolean {
  const d = new Date(dayTs);
  const pattern = routine.pattern;
  switch (pattern.kind) {
    case "weekly":
      return d.getUTCDay() === pattern.weekday;
    case "monthly-date":
      // Tanggal yang tidak ada di bulan berjalan memang tidak pernah
      // cocok — otomatis dilewati, bukan digeser (spec §13.2).
      return d.getUTCDate() === pattern.dayOfMonth;
    case "monthly-weekday": {
      if (d.getUTCDay() !== pattern.weekday) return false;
      if (pattern.weekOfMonth === "last") {
        // Tidak ada lagi hari yang sama di bulan ini setelah tanggal ini.
        return dayTs + 7 * DAY_MS > lastDayOfMonthTs(dayTs);
      }
      const nth = Math.floor((d.getUTCDate() - 1) / 7) + 1;
      return nth === pattern.weekOfMonth;
    }
  }
}

/** Cap waktu sintetis tanggal terakhir bulan dari tanggal mana pun di bulan itu. */
function lastDayOfMonthTs(dayTs: number): number {
  const d = new Date(dayTs);
  // Tanggal 0 pada bulan berikutnya = tanggal terakhir bulan ini.
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
}

/** Peta pengecualian per tanggal; edisi-spesial menang atas libur (spec §13.2). */
function exceptionsByDate(
  exceptions: RoutineExceptionRecord[],
): Map<string, RoutineExceptionRecord> {
  const map = new Map<string, RoutineExceptionRecord>();
  for (const ex of exceptions) {
    const prev = map.get(ex.date);
    if (!prev || (prev.kind === "libur" && ex.kind === "edisi-spesial")) {
      map.set(ex.date, ex);
    }
  }
  return map;
}

export function computeOccurrences(
  routine: RoutineInput,
  exceptions: RoutineExceptionRecord[],
  fromISO: string,
  count: number,
  opts?: { includeSkipped?: boolean },
): Occurrence[] {
  if (count <= 0) return [];
  const includeSkipped = opts?.includeSkipped === true;
  const fromTs = parseFromISO(fromISO);
  const byDate = exceptionsByDate(exceptions);

  // Mulai pindai dari sehari sebelum acuan agar kemunculan lintas tengah
  // malam yang masih berjalan (mulai kemarin, selesai dini hari ini)
  // tetap tertangkap.
  const firstDayTs = wallTs(
    new Date(fromTs).getUTCFullYear(),
    new Date(fromTs).getUTCMonth() + 1,
    new Date(fromTs).getUTCDate(),
  );
  const scanStartTs = firstDayTs - DAY_MS;
  const scanEndTs = scanStartTs + MAX_SCAN_DAYS * DAY_MS;

  const results: Occurrence[] = [];

  for (
    let dayTs = scanStartTs;
    dayTs <= scanEndTs && results.length < count;
    dayTs += DAY_MS
  ) {
    const date = dateOf(dayTs);

    // Batas berlaku (per tanggal kemunculan, banding string ISO aman).
    if (routine.effectiveFrom && date < routine.effectiveFrom) continue;
    if (routine.effectiveTo && date > routine.effectiveTo) break;

    if (!matchesPattern(routine, dayTs)) continue;

    const ex = byDate.get(date) ?? null;
    const isLibur = ex?.kind === "libur";
    if (isLibur && !includeSkipped) continue;

    // Nilai efektif: override edisi spesial menang atas nilai induk.
    const startTime =
      ex?.kind === "edisi-spesial" && ex.overrideStartTime
        ? ex.overrideStartTime
        : routine.startTime;
    const venueName =
      ex?.kind === "edisi-spesial" && ex.overrideVenueName
        ? ex.overrideVenueName
        : routine.venueName;
    const address =
      ex?.kind === "edisi-spesial" && ex.overrideAddress
        ? ex.overrideAddress
        : routine.address;

    const startTs = dayTs + minutesOf(startTime) * MINUTE_MS;
    let endTs: number;
    if (routine.endTime === null) {
      // Tanpa jam selesai: berlangsung sampai 23:59 hari yang sama.
      endTs = dayTs + (23 * 60 + 59) * MINUTE_MS;
    } else if (minutesOf(routine.endTime) < minutesOf(startTime)) {
      // Jam selesai lebih kecil dari jam mulai: keesokan hari.
      endTs = dayTs + DAY_MS + minutesOf(routine.endTime) * MINUTE_MS;
    } else {
      endTs = dayTs + minutesOf(routine.endTime) * MINUTE_MS;
    }

    // Kemunculan yang sudah selesai pada waktu acuan tidak ditampilkan.
    if (endTs <= fromTs) continue;

    results.push({
      date,
      startISO: isoOf(startTs),
      endISO: isoOf(endTs),
      isOngoing: startTs <= fromTs && fromTs < endTs,
      exceptionKind: ex ? ex.kind : null,
      note: ex ? ex.note : null,
      venueName,
      address,
      startTime,
    });
  }

  return results;
}
