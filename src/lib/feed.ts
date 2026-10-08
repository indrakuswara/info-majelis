// Rimba acara publik gabungan (plan Task 11; spec §9.1): event sekali
// jalan + kemunculan jadwal rutin, terurut kronologis menaik.
//
// HANYA memakai fungsi repository publik (published-only) — draft tidak
// dapat masuk dari jalur mana pun, dan record publik dari repository
// sudah bebas sourceInfo. Kemunculan rutin dihitung dengan
// computeOccurrences default: yang terkena pengecualian `libur` dilewati
// (kemunculan berikutnya yang tampil), `edisi-spesial` memakai override.

import {
  eventEndTs,
  eventStartTs,
  listPublishedDistricts,
  listPublishedMajelis,
  listPublishedRoutines,
  listPublishedUpcoming,
  listRoutineExceptions,
  rangeInterval,
  type UpcomingRange,
} from "./db.ts";
import type {
  Category,
  EventRecord,
  MajelisRecord,
  Occurrence,
  RoutineRecord,
} from "./domain.ts";
import { REGIONS } from "./constants.ts";
import { computeOccurrences, describePattern } from "./recurrence.ts";
import { addDaysISODate, wibTodayISODate } from "./format.ts";

export type { UpcomingRange };

/** Satu kartu di daftar publik: event sekali jalan atau kemunculan rutin. */
export interface FeedItem {
  kind: "event" | "occurrence";
  /** Kunci unik stabil untuk daftar (id event / slug rutin + tanggal). */
  key: string;
  /** Tujuan tautan kartu: detail event / detail rutin (Task 12). */
  href: string;
  title: string;
  category: Category;
  /** Tanggal kalender WIB kemunculan, "YYYY-MM-DD". */
  date: string;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm"; null = "s/d selesai". */
  endTime: string | null;
  venueName: string;
  address: string;
  district: string;
  city: string;
  posterUrl: string | null;
  organizerName: string | null;
  organizerLogoUrl: string | null;
  /** Penanda "Rutin" + pola singkat, mis. "Setiap Kamis" (khusus rutin). */
  patternLabel: string | null;
  /** Kemunculan terkena pengecualian edisi spesial (memakai override). */
  isSpecialEdition: boolean;
  specialNote: string | null;
  /** Sedang berlangsung pada waktu acuan. */
  isOngoing: boolean;
  /** Cap waktu sintetis dinding WIB untuk pengurutan. */
  sortTs: number;
}

export interface FeedFilter {
  range?: UpcomingRange;
  city?: string;
  district?: string;
  category?: Category;
  q?: string;
  /**
   * Batas hari kemunculan rutin & (bila capEvents) event dari hari ini.
   * Kemunculan rutin selalu dibatasi (jumlahnya tak berhingga); event
   * hanya dibatasi bila capEvents true (beranda), /acara membiarkan
   * semua event mendatang tampil sesuai filter rentangnya.
   */
  horizonDays?: number;
  capEvents?: boolean;
}

const DAY_MS = 24 * 60 * 60_000;

/** Cap waktu sintetis dinding WIB dari tanggal + jam (pola db.ts). */
function wallTs(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return Date.UTC(y, (mo ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
}

/** Cap waktu dari ISO dinding WIB "YYYY-MM-DDTHH:mm:ss+07:00". */
function isoWallTs(iso: string): number {
  return wallTs(iso.slice(0, 10), iso.slice(11, 16));
}

function resolveOrganizer(
  record: { organizerMajelisId: string | null; organizerNameManual: string | null },
  majelisById: Map<string, MajelisRecord>,
): { name: string | null; logoUrl: string | null } {
  if (record.organizerMajelisId) {
    const majelis = majelisById.get(record.organizerMajelisId);
    if (majelis) return { name: majelis.name, logoUrl: majelis.logoUrl };
  }
  return { name: record.organizerNameManual, logoUrl: null };
}

/** Pencocokan teks bebas untuk rutin — field sama seperti pencarian event
 * repository (judul, penceramah, tempat, kecamatan, deskripsi,
 * penyelenggara); sourceInfo tidak pernah ikut dicari. */
function routineMatchesQuery(
  r: RoutineRecord,
  q: string,
  organizerName: string | null,
): boolean {
  const haystack = [
    r.title,
    r.speakers.join(" "),
    r.venueName,
    r.district,
    r.description ?? "",
    r.organizerNameManual ?? "",
    organizerName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function eventToFeedItem(
  e: EventRecord,
  majelisById: Map<string, MajelisRecord>,
  nowTs: number,
): FeedItem {
  const organizer = resolveOrganizer(e, majelisById);
  return {
    kind: "event",
    key: `event-${e.id}`,
    href: `/event/${e.slug}`,
    title: e.title,
    category: e.category,
    date: e.startDate,
    startTime: e.startTime,
    endTime: e.endTime,
    venueName: e.venueName,
    address: e.address,
    district: e.district,
    city: e.city,
    posterUrl: e.posterUrl,
    organizerName: organizer.name,
    organizerLogoUrl: organizer.logoUrl,
    patternLabel: null,
    isSpecialEdition: false,
    specialNote: null,
    isOngoing: eventStartTs(e) <= nowTs && eventEndTs(e) >= nowTs,
    sortTs: eventStartTs(e),
  };
}

function occurrenceToFeedItem(
  r: RoutineRecord,
  o: Occurrence,
  majelisById: Map<string, MajelisRecord>,
): FeedItem {
  const organizer = resolveOrganizer(r, majelisById);
  const isSpecial = o.exceptionKind === "edisi-spesial";
  return {
    kind: "occurrence",
    key: `rutin-${r.id}-${o.date}`,
    href: `/rutin/${r.slug}`,
    title: r.title,
    category: r.category,
    date: o.date,
    startTime: o.startTime,
    endTime: r.endTime,
    venueName: o.venueName,
    address: o.address,
    district: r.district,
    city: r.city,
    posterUrl: r.posterUrl,
    organizerName: organizer.name,
    organizerLogoUrl: organizer.logoUrl,
    patternLabel: describePattern(r.pattern, { startTime: r.startTime }),
    isSpecialEdition: isSpecial,
    specialNote: isSpecial ? (o.note ?? r.specialNote) : null,
    isOngoing: o.isOngoing,
    sortTs: isoWallTs(o.startISO),
  };
}

/**
 * Rimba gabungan acara mendatang. `nowISO` = ISO datetime dinding WIB
 * (lihat nowWibISO di utils.ts).
 */
export async function getUpcomingFeed(
  nowISO: string,
  filter: FeedFilter = {},
): Promise<FeedItem[]> {
  const range = filter.range ?? "all";
  const horizonDays = filter.horizonDays ?? 60;
  const today = wibTodayISODate(new Date(nowISO));
  const horizonDate = addDaysISODate(today, horizonDays);
  const nowTs = isoWallTs(nowISO);
  const interval = rangeInterval(range, nowTs);

  const majelisList = await listPublishedMajelis({});
  const majelisById = new Map(majelisList.map((m) => [m.id, m]));

  const events = await listPublishedUpcoming({
    nowISO,
    range,
    city: filter.city,
    district: filter.district,
    category: filter.category,
    q: filter.q,
  });

  const items: FeedItem[] = [];
  for (const e of events) {
    if (filter.capEvents && e.startDate > horizonDate) continue;
    items.push(eventToFeedItem(e, majelisById, nowTs));
  }

  const routines = await listPublishedRoutines({
    city: filter.city,
    district: filter.district,
    category: filter.category,
  });
  for (const r of routines) {
    const organizer = resolveOrganizer(r, majelisById);
    if (filter.q && !routineMatchesQuery(r, filter.q, organizer.name)) {
      continue;
    }
    const exceptions = await listRoutineExceptions(r.id);
    // 40 kemunculan cukup untuk jendela 60 hari pada semua pola
    // (mingguan ≈ 9); hasil sesudahnya disaring per tanggal di bawah.
    const occurrences = computeOccurrences(r, exceptions, nowISO, 40);
    for (const o of occurrences) {
      if (o.date > horizonDate) break;
      if (interval) {
        const start = isoWallTs(o.startISO);
        const end = o.endISO ? isoWallTs(o.endISO) : start + DAY_MS;
        if (!(start < interval.end && end > interval.start)) continue;
      }
      items.push(occurrenceToFeedItem(r, o, majelisById));
    }
  }

  items.sort((a, b) => a.sortTs - b.sortTs || a.title.localeCompare(b.title));
  return items;
}

/**
 * Daftar kecamatan untuk datalist FilterBar publik: HANYA dari data
 * terbit (spec §9.1, listPublishedDistricts) — kecamatan yang hanya ada
 * di draft tidak boleh bocor ke saran publik. Untuk kota terpilih dari
 * kota itu; tanpa kota, gabungan seluruh wilayah (kecamatan memang
 * hanya bermakna bersama kotanya, tetapi saran bebas tetap membantu
 * pencarian).
 */
export async function getDistrictSuggestions(
  city?: string,
): Promise<string[]> {
  if (city) return listPublishedDistricts(city);
  const perCity = await Promise.all(
    REGIONS.map((region) => listPublishedDistricts(region)),
  );
  return [...new Set(perCity.flat())].sort((a, b) => a.localeCompare(b));
}
