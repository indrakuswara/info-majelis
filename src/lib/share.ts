// Teks share & tautan Google Maps (spec §10, §13.4) — fungsi murni, tanpa I/O.

/**
 * Teks share siap kirim, format PERSIS spec §10:
 * `*[Judul]* — [dateLabel], [timeLabel] di [venue], [district], [city]. Detail: [url]`
 * dateLabel/timeLabel sudah diformat pemanggil (mis. "Selasa, 20 Oktober 2026", "19.30 WIB").
 */
export function buildShareText(i: {
  title: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string;
  district: string;
  city: string;
  url: string;
}): string {
  return `*${i.title}* — ${i.dateLabel}, ${i.timeLabel} di ${i.venueName}, ${i.district}, ${i.city}. Detail: ${i.url}`;
}

/**
 * Tautan rute Google Maps: URL manual admin menang apa adanya;
 * fallback tautan pencarian Maps dari nama tempat + alamat + kecamatan + kota.
 */
export function buildMapsUrl(i: {
  mapsUrl: string | null;
  venueName: string;
  address: string;
  district: string;
  city: string;
}): string {
  const manual = i.mapsUrl?.trim();
  if (manual) return manual;
  const query = [i.venueName, i.address, i.district, i.city]
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const COORD_PATTERN = "(-?\\d+(?:\\.\\d+)?),(-?\\d+(?:\\.\\d+)?)";
const AT_COORDS = new RegExp(`@${COORD_PATTERN}`);
const QUERY_COORDS = new RegExp(`[?&]q=${COORD_PATTERN}`);

function toCoords(latText: string, lngText: string): { lat: number; lng: number } | null {
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Ekstrak koordinat dari URL Google Maps (best-effort, spec §13.4):
 * pola `@lat,lng` (URL place) dan `?q=lat,lng` / `&q=lat,lng`.
 * Gagal mengekstrak ⇒ null, BUKAN error.
 */
export function parseMapsCoords(
  url: string,
): { lat: number; lng: number } | null {
  if (!url) return null;
  const at = AT_COORDS.exec(url);
  if (at) {
    const coords = toCoords(at[1], at[2]);
    if (coords) return coords;
  }
  const query = QUERY_COORDS.exec(url);
  if (query) {
    const coords = toCoords(query[1], query[2]);
    if (coords) return coords;
  }
  return null;
}
