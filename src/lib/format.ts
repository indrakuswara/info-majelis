// Format tanggal/jam untuk halaman publik (plan Task 11; spec §9.2).
// Fungsi MURNI. Semua tanggal diperlakukan sebagai tanggal kalender
// Asia/Jakarta (WIB): input "YYYY-MM-DD" adalah tanggal dinding WIB apa
// adanya; input ISO datetime penuh diformat dalam zona Asia/Jakarta via
// Intl dengan timeZone eksplisit — zona waktu mesin tidak pernah ikut
// menggeser hari.

const WIB = "Asia/Jakarta";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → cap waktu UTC tengah hari (aman dari geser zona). */
function dateOnlyToUtcNoon(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12);
}

/**
 * Label tanggal lengkap Bahasa Indonesia, mis. "Kamis, 15 Oktober 2026".
 * Menerima "YYYY-MM-DD" (tanggal kalender WIB) atau ISO datetime penuh
 * (diformat pada zona WIB).
 */
export function formatTanggal(iso: string): string {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (DATE_ONLY_RE.test(iso)) {
    return fmt.format(new Date(dateOnlyToUtcNoon(iso)));
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return fmt.format(parsed);
}

/** Label tanggal ringkas tanpa nama hari, mis. "15 Oktober 2026". */
export function formatTanggalSingkat(isoDate: string): string {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (DATE_ONLY_RE.test(isoDate)) {
    return fmt.format(new Date(dateOnlyToUtcNoon(isoDate)));
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return fmt.format(parsed);
}

/**
 * Rentang jam tampil, mis. "19:30 – 21:00 WIB".
 * endTime null ⇒ "19:30 WIB – selesai" (spec §6.2).
 */
export function formatJamRange(start: string, end: string | null): string {
  return end ? `${start} – ${end} WIB` : `${start} WIB – selesai`;
}

/** Tambah n hari pada tanggal "YYYY-MM-DD" (aritmetika kalender UTC). */
export function addDaysISODate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const ts = Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days);
  const dt = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Label relatif terhadap hari ini: "Hari ini" bila tanggal sama,
 * "Besok" bila tepat keesokan harinya, "" selain itu.
 * Keduanya tanggal kalender "YYYY-MM-DD" (WIB).
 */
export function relativeDayLabel(isoDate: string, todayIso: string): string {
  if (isoDate === todayIso) return "Hari ini";
  if (isoDate === addDaysISODate(todayIso, 1)) return "Besok";
  return "";
}

/** Tanggal kalender WIB hari ini sebagai "YYYY-MM-DD". */
export function wibTodayISODate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
