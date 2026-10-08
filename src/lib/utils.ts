// Utilitas format umum (murni, tanpa I/O) — dipakai UI admin & publik.

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
