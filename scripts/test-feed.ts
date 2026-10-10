import assert from "node:assert/strict";
import type {
  EventRecord,
  MajelisRecord,
  Occurrence,
  RoutineRecord,
} from "../src/lib/domain.ts";
import { eventToFeedItem, occurrenceToFeedItem } from "../src/lib/feed.ts";

// Kartu featured menampilkan penceramah, deskripsi, dan alamat lengkap —
// ketiga field ini wajib terbawa dari record ke FeedItem oleh kedua builder.

const majelisById = new Map<string, MajelisRecord>();
const nowTs = Date.parse("2026-10-10T00:00:00.000Z");

const baseCommon = {
  venueName: "Lapangan Monas",
  address: "Lapangan Monas, Jl. Silang Merdeka, Gambir, Jakarta Pusat 10110",
  city: "Jakarta Pusat",
  district: "Gambir",
  mapsUrl: null,
  lat: null,
  lng: null,
  title: "Tabligh Akbar & Do'a Untuk Indonesia",
  category: "tabligh-akbar" as const,
  startTime: "20:00",
  endTime: null,
  description: "Tabligh akbar dan doa bersama untuk Indonesia.",
  posterUrl: null,
  organizerMajelisId: null,
  organizerNameManual: null,
  speakers: ["Habib Umar bin Hafidz"],
  audience: "umum" as const,
  liveStreamUrl: null,
  contact: null,
  extraInfo: null,
  libraryUrl: null,
  sourceInfo: null,
  status: "published" as const,
  createdBy: "admin",
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
};

const event: EventRecord = {
  ...baseCommon,
  id: "evt-1",
  slug: "tabligh-akbar-doa-untuk-indonesia",
  startDate: "2026-10-12",
  endDate: null,
};

const eventItem = eventToFeedItem(event, majelisById, nowTs);
assert.deepEqual(eventItem.speakers, ["Habib Umar bin Hafidz"]);
assert.equal(eventItem.description, "Tabligh akbar dan doa bersama untuk Indonesia.");
assert.equal(
  eventItem.address,
  "Lapangan Monas, Jl. Silang Merdeka, Gambir, Jakarta Pusat 10110",
);

// Event tanpa penceramah/deskripsi: teruskan apa adanya (kosong/null).
const bareItem = eventToFeedItem(
  { ...event, speakers: [], description: null },
  majelisById,
  nowTs,
);
assert.deepEqual(bareItem.speakers, []);
assert.equal(bareItem.description, null);

const routine: RoutineRecord = {
  ...baseCommon,
  title: "Pengajian Rutin Kamis Malam",
  speakers: ["KH. Ahmad Contoh"],
  description: "Kajian kitab kuning ba'da Isya.",
  id: "rtn-1",
  slug: "pengajian-rutin-kamis",
  pattern: { kind: "weekly", weekday: 4 },
  effectiveFrom: null,
  effectiveTo: null,
  specialNote: null,
  isActive: true,
};

const occurrence: Occurrence = {
  date: "2026-10-15",
  startISO: "2026-10-15T12:30:00.000Z",
  endISO: null,
  isOngoing: false,
  exceptionKind: null,
  note: null,
  venueName: "Lapangan Monas",
  address: "Lapangan Monas, Jl. Silang Merdeka, Gambir, Jakarta Pusat 10110",
  startTime: "19:30",
};

const occItem = occurrenceToFeedItem(routine, occurrence, majelisById);
assert.deepEqual(occItem.speakers, ["KH. Ahmad Contoh"]);
assert.equal(occItem.description, "Kajian kitab kuning ba'da Isya.");
assert.equal(occItem.address, occurrence.address);

console.log("test-feed: semua lolos");
