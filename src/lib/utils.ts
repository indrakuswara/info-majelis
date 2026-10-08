// Utilitas format umum (murni, tanpa I/O) — dipakai UI admin & publik.

/**
 * Tanggal penanda untuk draft Event yang tanggal mulainya belum diisi.
 * Repository (Task 4) mewajibkan tanggal valid pada setiap record,
 * sementara spec §6.6 mengizinkan draft disimpan setengah jadi — server
 * action Event menyimpan tanggal ini sebagai penanda "belum terisi",
 * dan gerbang publish di server memetakannya kembali sebagai field
 * kurang. Tanggal ini tidak pernah lolos ke publik: record penanda
 * selalu berstatus draft, dan daftar admin menampilkannya sebagai
 * "Tanggal belum diisi".
 */
export const EVENT_DRAFT_PLACEHOLDER_DATE = "9999-12-31";

/**
 * "Sekarang" sebagai ISO datetime dinding WIB
 * ("YYYY-MM-DDTHH:mm:ss+07:00") — format acuan yang diterima
 * computeOccurrences. Aman dipakai di server maupun klien (Intl).
 */
export function nowWibISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+07:00`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Waktu relatif Bahasa Indonesia dari timestamp ISO, mis. "baru saja",
 * "5 menit lalu", "2 jam lalu", "3 hari lalu". Lewat seminggu, tampilkan
 * tanggal kalender WIB (mis. "8 Okt 2026").
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "-";
  const diff = now.getTime() - then;
  if (diff < MINUTE_MS) return "baru saja";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} menit lalu`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} jam lalu`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(then));
}
