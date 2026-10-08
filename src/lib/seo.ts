// Utilitas SEO publik (spec §12): URL kanonis situs, gambar OG per
// kategori, dan data terstruktur schema.org/Event (JSON-LD).
// Fungsi murni selain pembacaan env NEXT_PUBLIC_SITE_URL.

import type { Category } from "./domain.ts";

/**
 * Origin situs dari env, tanpa garis miring di akhir.
 * Kosong ("") bila env belum dipasang (dev lokal) — pemanggil yang
 * butuh URL absolut memakai fallback yang masuk akal di konteksnya.
 */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
}

/**
 * Jadikan path situs ("/acara/...") URL absolut bila origin situs
 * diketahui; di dev tanpa env dikembalikan apa adanya (path relatif).
 * URL yang sudah absolut (http/https) tidak diubah.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const site = getSiteUrl();
  if (!site) return path;
  return `${site}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Gambar Open Graph statis per kategori (dihasilkan scripts/make-og.ts). */
export function categoryOgImagePath(category: Category): string {
  return `/og/${category}.png`;
}

export interface EventJsonLdInput {
  title: string;
  /** ISO datetime dengan offset, mis. "2026-10-20T19:30:00+07:00". */
  startISO: string;
  /** ISO datetime dengan offset; null = tanpa waktu selesai pasti. */
  endISO: string | null;
  venueName: string;
  address: string;
  district: string;
  city: string;
  organizerName: string | null;
  /** Path/URL profil majelis penyelenggara bila terdaftar. */
  organizerUrl: string | null;
  description: string | null;
  /** Path/URL poster; null = tanpa gambar. */
  imageUrl: string | null;
  /** Path kanonis halaman detail ini. */
  canonicalPath: string;
}

/**
 * Objek JSON-LD schema.org/Event (spec §12). Hanya field yang memang
 * tampil di halaman yang dimasukkan — sourceInfo dan data internal
 * admin tidak pernah menjadi input fungsi ini.
 */
export function buildEventJsonLd(i: EventJsonLdInput): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: i.title,
    startDate: i.startISO,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: i.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: i.address,
        addressLocality: i.city,
        addressRegion: i.district,
        addressCountry: "ID",
      },
    },
    url: absoluteUrl(i.canonicalPath),
  };
  if (i.endISO) jsonLd.endDate = i.endISO;
  if (i.description) jsonLd.description = i.description;
  if (i.imageUrl) jsonLd.image = [absoluteUrl(i.imageUrl)];
  if (i.organizerName) {
    const organizer: Record<string, unknown> = {
      "@type": "Organization",
      name: i.organizerName,
    };
    if (i.organizerUrl) organizer.url = absoluteUrl(i.organizerUrl);
    jsonLd.organizer = organizer;
  }
  return jsonLd;
}

/**
 * Serialisasi JSON-LD yang aman disisipkan ke <script>: karakter "<"
 * diescape sebagai < agar teks berisi "</script>" tidak dapat
 * memecah elemen script.
 */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Potong teks untuk meta description (±160 karakter, di batas kata). */
export function truncateDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
