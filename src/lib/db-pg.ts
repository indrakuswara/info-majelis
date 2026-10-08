// Implementasi Postgres (Neon) untuk lapisan database Info Majelis
// (plan Task 4). Setara fungsi-per-fungsi dengan implementasi SQLite di
// db.ts; db.ts adalah facade yang mendelegasikan ke berkas ini bila env
// DATABASE_URL terisi.
//
// Helper murni (validasi tanggal/waktu, hitung selesai event, skema DDL)
// dipakai bersama dari db.ts agar kedua backend tidak pernah berbeda
// perilaku; pemakaian hanya terjadi saat fungsi dipanggil (bukan saat
// modul dimuat), jadi tidak ada masalah siklus impor.
// Dialek: placeholder $1.., pencarian admin/search memakai ILIKE.
// Paritas berkas ini diverifikasi di production (Task 16) — koneksi
// Postgres langsung dari sandbox memang gagal (TLS/proxy).

import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type {
  EventRecord,
  MajelisRecord,
  RoutineExceptionRecord,
  RoutineRecord,
} from "./domain.ts";
import { slugify, uniqueSlug } from "./slug.ts";
import { computeOccurrences } from "./recurrence.ts";
import {
  SCHEMA_STATEMENTS,
  assertValidDateString,
  assertValidTimeString,
  definedOnly,
  escapeLike,
  eventEndTs,
  eventStartTs,
  nowISODateTime,
  parseISODateTime,
  rangeInterval,
  validateScheduleDates,
  wibNowTs,
  type AdminListFilter,
  type ArchiveFilter,
  type EventInput,
  type MajelisInput,
  type ManualOrganizerGroup,
  type PromoteResult,
  type PublishedMajelisFilter,
  type PublishedRoutineFilter,
  type RoutineExceptionInput,
  type RoutineInput,
  type SearchFilter,
  type UpcomingFilter,
} from "./db.ts";

type Row = Record<string, unknown>;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

async function query(text: string, params: unknown[] = []): Promise<Row[]> {
  const res = await getPool().query(text, params);
  return res.rows as Row[];
}

async function queryOne(
  text: string,
  params: unknown[] = [],
): Promise<Row | null> {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/** $1..$n untuk daftar kolom. */
function placeholders(count: number, start = 1): string {
  return Array.from({ length: count }, (_, i) => `$${start + i}`).join(", ");
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}
function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}
function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}

function parseSpeakers(v: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(str(v) || "[]");
    return Array.isArray(parsed) ? parsed.map((s) => String(s)) : [];
  } catch {
    return [];
  }
}

function toMajelis(r: Row): MajelisRecord {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    city: str(r.city),
    leader: strOrNull(r.leader),
    logoUrl: strOrNull(r.logo_url),
    photoUrl: strOrNull(r.photo_url),
    baseAddress: strOrNull(r.base_address),
    baseDistrict: strOrNull(r.base_district),
    baseMapsUrl: strOrNull(r.base_maps_url),
    description: strOrNull(r.description),
    instagramUrl: strOrNull(r.instagram_url),
    youtubeUrl: strOrNull(r.youtube_url),
    tiktokUrl: strOrNull(r.tiktok_url),
    websiteUrl: strOrNull(r.website_url),
    contact: strOrNull(r.contact),
    status: str(r.status) as MajelisRecord["status"],
    createdBy: str(r.created_by),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

function toEvent(r: Row, publicView = false): EventRecord {
  return {
    id: str(r.id),
    slug: str(r.slug),
    title: str(r.title),
    category: str(r.category) as EventRecord["category"],
    startDate: str(r.start_date),
    endDate: strOrNull(r.end_date),
    startTime: str(r.start_time),
    endTime: strOrNull(r.end_time),
    venueName: str(r.venue_name),
    address: str(r.address),
    city: str(r.city),
    district: str(r.district),
    mapsUrl: strOrNull(r.maps_url),
    lat: numOrNull(r.lat),
    lng: numOrNull(r.lng),
    description: strOrNull(r.description),
    posterUrl: strOrNull(r.poster_url),
    organizerMajelisId: strOrNull(r.organizer_majelis_id),
    organizerNameManual: strOrNull(r.organizer_name_manual),
    speakers: parseSpeakers(r.speakers),
    audience: str(r.audience) as EventRecord["audience"],
    liveStreamUrl: strOrNull(r.live_stream_url),
    contact: strOrNull(r.contact),
    extraInfo: strOrNull(r.extra_info),
    libraryUrl: strOrNull(r.library_url),
    sourceInfo: publicView ? null : strOrNull(r.source_info),
    status: str(r.status) as EventRecord["status"],
    createdBy: str(r.created_by),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

function toRoutine(r: Row, publicView = false): RoutineRecord {
  return {
    id: str(r.id),
    slug: str(r.slug),
    title: str(r.title),
    category: str(r.category) as RoutineRecord["category"],
    pattern: JSON.parse(str(r.pattern)) as RoutineRecord["pattern"],
    startTime: str(r.start_time),
    endTime: strOrNull(r.end_time),
    effectiveFrom: strOrNull(r.effective_from),
    effectiveTo: strOrNull(r.effective_to),
    specialNote: strOrNull(r.special_note),
    isActive: Number(r.is_active) === 1,
    venueName: str(r.venue_name),
    address: str(r.address),
    city: str(r.city),
    district: str(r.district),
    mapsUrl: strOrNull(r.maps_url),
    lat: numOrNull(r.lat),
    lng: numOrNull(r.lng),
    description: strOrNull(r.description),
    posterUrl: strOrNull(r.poster_url),
    organizerMajelisId: strOrNull(r.organizer_majelis_id),
    organizerNameManual: strOrNull(r.organizer_name_manual),
    speakers: parseSpeakers(r.speakers),
    audience: str(r.audience) as RoutineRecord["audience"],
    liveStreamUrl: strOrNull(r.live_stream_url),
    contact: strOrNull(r.contact),
    extraInfo: strOrNull(r.extra_info),
    libraryUrl: strOrNull(r.library_url),
    sourceInfo: publicView ? null : strOrNull(r.source_info),
    status: str(r.status) as RoutineRecord["status"],
    createdBy: str(r.created_by),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

function toException(r: Row): RoutineExceptionRecord {
  return {
    id: str(r.id),
    routineId: str(r.routine_id),
    date: str(r.date),
    kind: str(r.kind) as RoutineExceptionRecord["kind"],
    note: strOrNull(r.note),
    overrideVenueName: strOrNull(r.override_venue_name),
    overrideAddress: strOrNull(r.override_address),
    overrideStartTime: strOrNull(r.override_start_time),
    overrideDescription: strOrNull(r.override_description),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

async function takenSlugs(table: string): Promise<Set<string>> {
  const rows = await query(`SELECT slug FROM ${table}`);
  return new Set(rows.map((r) => str(r.slug)));
}

async function resolveSlug(
  table: string,
  provided: string | undefined,
  baseText: string,
  fallback: string,
  excludeSlug?: string,
): Promise<string> {
  const base = slugify(provided?.trim() ? provided : baseText) || fallback;
  const taken = await takenSlugs(table);
  if (excludeSlug) taken.delete(excludeSlug);
  return uniqueSlug(base, taken);
}

// ---------------------------------------------------------------------------
// Skema
// ---------------------------------------------------------------------------

export async function ensureSchema(): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await query(stmt);
  }
}

// ---------------------------------------------------------------------------
// Majelis
// ---------------------------------------------------------------------------

const MAJELIS_INSERT = `INSERT INTO majelis (id, slug, name, city, leader,
  logo_url, photo_url, base_address, base_district, base_maps_url,
  description, instagram_url, youtube_url, tiktok_url, website_url, contact,
  status, created_by, created_at, updated_at) VALUES (${placeholders(20)})`;

function majelisValues(m: MajelisRecord): unknown[] {
  return [
    m.id, m.slug, m.name, m.city, m.leader, m.logoUrl, m.photoUrl,
    m.baseAddress, m.baseDistrict, m.baseMapsUrl, m.description,
    m.instagramUrl, m.youtubeUrl, m.tiktokUrl, m.websiteUrl, m.contact,
    m.status, m.createdBy, m.createdAt, m.updatedAt,
  ];
}

export async function createMajelis(
  input: MajelisInput,
): Promise<MajelisRecord> {
  const ts = nowISODateTime();
  const record: MajelisRecord = {
    ...input,
    id: randomUUID(),
    slug: await resolveSlug("majelis", input.slug, input.name, "majelis"),
    createdAt: ts,
    updatedAt: ts,
  };
  await query(MAJELIS_INSERT, majelisValues(record));
  return record;
}

export async function getMajelisById(
  id: string,
): Promise<MajelisRecord | null> {
  const row = await queryOne("SELECT * FROM majelis WHERE id = $1", [id]);
  return row ? toMajelis(row) : null;
}

export async function updateMajelis(
  id: string,
  patch: Partial<MajelisInput>,
): Promise<MajelisRecord | null> {
  const existing = await getMajelisById(id);
  if (!existing) return null;
  const clean = definedOnly(patch);
  const merged: MajelisRecord = {
    ...existing,
    ...clean,
    id: existing.id,
    slug:
      clean.slug !== undefined && clean.slug !== existing.slug
        ? await resolveSlug("majelis", clean.slug, clean.slug ?? "", "majelis", existing.slug)
        : existing.slug,
    createdAt: existing.createdAt,
    updatedAt: nowISODateTime(),
  };
  await query(
    `UPDATE majelis SET slug=$1, name=$2, city=$3, leader=$4, logo_url=$5,
      photo_url=$6, base_address=$7, base_district=$8, base_maps_url=$9,
      description=$10, instagram_url=$11, youtube_url=$12, tiktok_url=$13,
      website_url=$14, contact=$15, status=$16, created_by=$17, updated_at=$18
     WHERE id=$19`,
    [
      merged.slug, merged.name, merged.city, merged.leader, merged.logoUrl,
      merged.photoUrl, merged.baseAddress, merged.baseDistrict,
      merged.baseMapsUrl, merged.description, merged.instagramUrl,
      merged.youtubeUrl, merged.tiktokUrl, merged.websiteUrl, merged.contact,
      merged.status, merged.createdBy, merged.updatedAt, id,
    ],
  );
  return merged;
}

export async function deleteMajelis(id: string): Promise<void> {
  const ts = nowISODateTime();
  await query(
    "UPDATE events SET organizer_majelis_id = NULL, updated_at = $1 WHERE organizer_majelis_id = $2",
    [ts, id],
  );
  await query(
    "UPDATE routines SET organizer_majelis_id = NULL, updated_at = $1 WHERE organizer_majelis_id = $2",
    [ts, id],
  );
  await query("DELETE FROM majelis WHERE id = $1", [id]);
}

export async function listAdminMajelis(
  filter: AdminListFilter,
): Promise<MajelisRecord[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(filter.status);
    conds.push(`status = $${params.length}`);
  }
  if (filter.q) {
    const p = `%${escapeLike(filter.q)}%`;
    params.push(p, p);
    conds.push(
      `(name ILIKE $${params.length - 1} ESCAPE '\\' OR leader ILIKE $${params.length} ESCAPE '\\')`,
    );
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await query(
    `SELECT * FROM majelis ${where} ORDER BY updated_at DESC`,
    params,
  );
  return rows.map(toMajelis);
}

export async function listPublishedMajelis(
  filter: PublishedMajelisFilter,
): Promise<MajelisRecord[]> {
  const conds = ["status = 'published'"];
  const params: unknown[] = [];
  if (filter.city) {
    params.push(filter.city);
    conds.push(`city = $${params.length}`);
  }
  const rows = await query(
    `SELECT * FROM majelis WHERE ${conds.join(" AND ")} ORDER BY name ASC`,
    params,
  );
  return rows.map(toMajelis);
}

export async function getPublishedMajelisBySlug(
  slug: string,
): Promise<MajelisRecord | null> {
  const row = await queryOne(
    "SELECT * FROM majelis WHERE slug = $1 AND status = 'published'",
    [slug],
  );
  return row ? toMajelis(row) : null;
}

export async function listManualOrganizerNames(): Promise<
  ManualOrganizerGroup[]
> {
  const groups = new Map<string, ManualOrganizerGroup>();
  const collect = async (table: string, key: "eventCount" | "routineCount") => {
    const rows = await query(
      `SELECT organizer_name_manual AS name, city, COUNT(*) AS n FROM ${table}
       WHERE organizer_majelis_id IS NULL AND organizer_name_manual IS NOT NULL
         AND TRIM(organizer_name_manual) <> ''
       GROUP BY organizer_name_manual, city`,
    );
    for (const r of rows) {
      const k = `${str(r.name)}\n${str(r.city)}`;
      const g = groups.get(k) ?? {
        name: str(r.name), city: str(r.city), eventCount: 0, routineCount: 0,
      };
      g[key] = Number(r.n);
      groups.set(k, g);
    }
  };
  await collect("events", "eventCount");
  await collect("routines", "routineCount");
  return [...groups.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.city.localeCompare(b.city),
  );
}

export async function promoteManualOrganizer(
  name: string,
  city: string,
): Promise<PromoteResult> {
  const majelis = await createMajelis({
    name,
    city,
    leader: null,
    logoUrl: null,
    photoUrl: null,
    baseAddress: null,
    baseDistrict: null,
    baseMapsUrl: null,
    description: null,
    instagramUrl: null,
    youtubeUrl: null,
    tiktokUrl: null,
    websiteUrl: null,
    contact: null,
    status: "published",
    createdBy: "admin",
  });
  const ts = nowISODateTime();
  const ev = await getPool().query(
    `UPDATE events SET organizer_majelis_id = $1, organizer_name_manual = NULL,
      updated_at = $2 WHERE organizer_name_manual = $3 AND city = $4`,
    [majelis.id, ts, name, city],
  );
  const rt = await getPool().query(
    `UPDATE routines SET organizer_majelis_id = $1, organizer_name_manual = NULL,
      updated_at = $2 WHERE organizer_name_manual = $3 AND city = $4`,
    [majelis.id, ts, name, city],
  );
  return {
    majelis,
    linkedEvents: ev.rowCount ?? 0,
    linkedRoutines: rt.rowCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

const EVENT_COLUMNS = `id, slug, title, category, start_date, end_date,
  start_time, end_time, venue_name, address, city, district, maps_url, lat,
  lng, description, poster_url, organizer_majelis_id, organizer_name_manual,
  speakers, audience, live_stream_url, contact, extra_info, library_url,
  source_info, status, created_by, created_at, updated_at`;

function eventValues(e: EventRecord): unknown[] {
  return [
    e.id, e.slug, e.title, e.category, e.startDate, e.endDate, e.startTime,
    e.endTime, e.venueName, e.address, e.city, e.district, e.mapsUrl, e.lat,
    e.lng, e.description, e.posterUrl, e.organizerMajelisId,
    e.organizerNameManual, JSON.stringify(e.speakers), e.audience,
    e.liveStreamUrl, e.contact, e.extraInfo, e.libraryUrl, e.sourceInfo,
    e.status, e.createdBy, e.createdAt, e.updatedAt,
  ];
}

export async function createEvent(input: EventInput): Promise<EventRecord> {
  validateScheduleDates(input);
  const ts = nowISODateTime();
  const record: EventRecord = {
    ...input,
    id: randomUUID(),
    slug: await resolveSlug("events", input.slug, input.title, "event"),
    createdAt: ts,
    updatedAt: ts,
  };
  await query(
    `INSERT INTO events (${EVENT_COLUMNS}) VALUES (${placeholders(30)})`,
    eventValues(record),
  );
  return record;
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  const row = await queryOne("SELECT * FROM events WHERE id = $1", [id]);
  return row ? toEvent(row) : null;
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput>,
): Promise<EventRecord | null> {
  const existing = await getEventById(id);
  if (!existing) return null;
  const clean = definedOnly(patch);
  const merged: EventRecord = {
    ...existing,
    ...clean,
    id: existing.id,
    slug:
      clean.slug !== undefined && clean.slug !== existing.slug
        ? await resolveSlug("events", clean.slug, clean.slug ?? "", "event", existing.slug)
        : existing.slug,
    createdAt: existing.createdAt,
    updatedAt: nowISODateTime(),
  };
  validateScheduleDates(merged);
  const v = eventValues(merged);
  await query(
    `UPDATE events SET slug=$2, title=$3, category=$4, start_date=$5,
      end_date=$6, start_time=$7, end_time=$8, venue_name=$9, address=$10,
      city=$11, district=$12, maps_url=$13, lat=$14, lng=$15,
      description=$16, poster_url=$17, organizer_majelis_id=$18,
      organizer_name_manual=$19, speakers=$20, audience=$21,
      live_stream_url=$22, contact=$23, extra_info=$24, library_url=$25,
      source_info=$26, status=$27, created_by=$28, updated_at=$29
     WHERE id=$1`,
    // Parameter: seluruh nilai kecuali created_at ($posisi 29 di array),
    // ditambah updated_at sebagai $29.
    [v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10],
     v[11], v[12], v[13], v[14], v[15], v[16], v[17], v[18], v[19], v[20],
     v[21], v[22], v[23], v[24], v[25], v[26], v[27], v[29]],
  );
  return merged;
}

export async function deleteEvent(id: string): Promise<void> {
  await query("DELETE FROM events WHERE id = $1", [id]);
}

export async function listAdminEvents(
  filter: AdminListFilter,
): Promise<EventRecord[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(filter.status);
    conds.push(`status = $${params.length}`);
  }
  if (filter.q) {
    const p = `%${escapeLike(filter.q)}%`;
    params.push(p, p, p);
    conds.push(
      `(title ILIKE $${params.length - 2} ESCAPE '\\' OR organizer_name_manual ILIKE $${params.length - 1} ESCAPE '\\' OR venue_name ILIKE $${params.length} ESCAPE '\\')`,
    );
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await query(
    `SELECT * FROM events ${where} ORDER BY updated_at DESC`,
    params,
  );
  return rows.map((r) => toEvent(r));
}

async function publishedEventRows(): Promise<Row[]> {
  return query("SELECT * FROM events WHERE status = 'published'");
}

function matchesEventFilters(
  e: EventRecord,
  f: { city?: string; district?: string; category?: string },
): boolean {
  if (f.city && e.city !== f.city) return false;
  if (f.district && e.district !== f.district) return false;
  if (f.category && e.category !== f.category) return false;
  return true;
}

export async function listPublishedUpcoming(
  filter: UpcomingFilter,
): Promise<EventRecord[]> {
  const nowTs = parseISODateTime(filter.nowISO);
  const interval = rangeInterval(filter.range ?? "all", nowTs);
  const rows = await publishedEventRows();
  return rows
    .map((r) => toEvent(r, true))
    .filter((e) => matchesEventFilters(e, filter))
    .filter((e) => {
      const end = eventEndTs(e);
      if (end <= nowTs) return false;
      if (interval) {
        const start = eventStartTs(e);
        if (!(start < interval.end && end > interval.start)) return false;
      }
      return true;
    })
    .sort((a, b) => eventStartTs(a) - eventStartTs(b));
}

export async function listPublishedArchive(
  filter: ArchiveFilter,
): Promise<EventRecord[]> {
  const syntheticNow = wibNowTs();
  const rows = await publishedEventRows();
  return rows
    .map((r) => toEvent(r, true))
    .filter((e) => matchesEventFilters(e, filter))
    .filter((e) => {
      if (
        filter.q &&
        !`${e.title} ${e.venueName} ${e.district} ${e.description ?? ""}`
          .toLowerCase()
          .includes(filter.q.toLowerCase())
      ) {
        return false;
      }
      return eventEndTs(e) <= syntheticNow;
    })
    .sort((a, b) => eventStartTs(b) - eventStartTs(a));
}

export async function getPublishedEventBySlug(
  slug: string,
): Promise<EventRecord | null> {
  const row = await queryOne(
    "SELECT * FROM events WHERE slug = $1 AND status = 'published'",
    [slug],
  );
  return row ? toEvent(row, true) : null;
}

export async function searchPublishedEvents(
  q: string,
  filter: SearchFilter,
): Promise<EventRecord[]> {
  const conds: string[] = ["e.status = 'published'"];
  const params: unknown[] = [];
  if (filter.city) {
    params.push(filter.city);
    conds.push(`e.city = $${params.length}`);
  }
  if (filter.category) {
    params.push(filter.category);
    conds.push(`e.category = $${params.length}`);
  }
  const pattern = `%${escapeLike(q)}%`;
  const first = params.length + 1;
  params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  // CATATAN: source_info sengaja TIDAK ikut dicari (spec §9.8).
  conds.push(
    `(e.title ILIKE $${first} ESCAPE '\\' OR e.speakers ILIKE $${first + 1} ESCAPE '\\'
      OR e.venue_name ILIKE $${first + 2} ESCAPE '\\' OR e.district ILIKE $${first + 3} ESCAPE '\\'
      OR COALESCE(e.description, '') ILIKE $${first + 4} ESCAPE '\\'
      OR COALESCE(e.organizer_name_manual, '') ILIKE $${first + 5} ESCAPE '\\'
      OR COALESCE(m.name, '') ILIKE $${first + 6} ESCAPE '\\')`,
  );
  const rows = await query(
    `SELECT e.* FROM events e
     LEFT JOIN majelis m ON m.id = e.organizer_majelis_id
     WHERE ${conds.join(" AND ")}
     ORDER BY e.start_date ASC, e.start_time ASC`,
    params,
  );
  return rows.map((r) => toEvent(r, true));
}

// ---------------------------------------------------------------------------
// Jadwal Rutin
// ---------------------------------------------------------------------------

const ROUTINE_COLUMNS = `id, slug, title, category, pattern, start_time,
  end_time, effective_from, effective_to, special_note, is_active, venue_name,
  address, city, district, maps_url, lat, lng, description, poster_url,
  organizer_majelis_id, organizer_name_manual, speakers, audience,
  live_stream_url, contact, extra_info, library_url, source_info, status,
  created_by, created_at, updated_at`;

function routineValues(r: RoutineRecord): unknown[] {
  return [
    r.id, r.slug, r.title, r.category, JSON.stringify(r.pattern), r.startTime,
    r.endTime, r.effectiveFrom, r.effectiveTo, r.specialNote,
    r.isActive ? 1 : 0, r.venueName, r.address, r.city, r.district, r.mapsUrl,
    r.lat, r.lng, r.description, r.posterUrl, r.organizerMajelisId,
    r.organizerNameManual, JSON.stringify(r.speakers), r.audience,
    r.liveStreamUrl, r.contact, r.extraInfo, r.libraryUrl, r.sourceInfo,
    r.status, r.createdBy, r.createdAt, r.updatedAt,
  ];
}

export async function createRoutine(
  input: RoutineInput,
): Promise<RoutineRecord> {
  validateScheduleDates(input);
  const ts = nowISODateTime();
  const record: RoutineRecord = {
    ...input,
    id: randomUUID(),
    slug: await resolveSlug("routines", input.slug, input.title, "rutin"),
    createdAt: ts,
    updatedAt: ts,
  };
  await query(
    `INSERT INTO routines (${ROUTINE_COLUMNS}) VALUES (${placeholders(34)})`,
    routineValues(record),
  );
  return record;
}

export async function getRoutineById(
  id: string,
): Promise<RoutineRecord | null> {
  const row = await queryOne("SELECT * FROM routines WHERE id = $1", [id]);
  return row ? toRoutine(row) : null;
}

export async function updateRoutine(
  id: string,
  patch: Partial<RoutineInput>,
): Promise<RoutineRecord | null> {
  const existing = await getRoutineById(id);
  if (!existing) return null;
  const clean = definedOnly(patch);
  const merged: RoutineRecord = {
    ...existing,
    ...clean,
    id: existing.id,
    slug:
      clean.slug !== undefined && clean.slug !== existing.slug
        ? await resolveSlug("routines", clean.slug, clean.slug ?? "", "rutin", existing.slug)
        : existing.slug,
    createdAt: existing.createdAt,
    updatedAt: nowISODateTime(),
  };
  validateScheduleDates(merged);
  const v = routineValues(merged);
  await query(
    `UPDATE routines SET slug=$2, title=$3, category=$4, pattern=$5,
      start_time=$6, end_time=$7, effective_from=$8, effective_to=$9,
      special_note=$10, is_active=$11, venue_name=$12, address=$13, city=$14,
      district=$15, maps_url=$16, lat=$17, lng=$18, description=$19,
      poster_url=$20, organizer_majelis_id=$21, organizer_name_manual=$22,
      speakers=$23, audience=$24, live_stream_url=$25, contact=$26,
      extra_info=$27, library_url=$28, source_info=$29, status=$30,
      created_by=$31, updated_at=$32 WHERE id=$1`,
    [v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10],
     v[11], v[12], v[13], v[14], v[15], v[16], v[17], v[18], v[19], v[20],
     v[21], v[22], v[23], v[24], v[25], v[26], v[27], v[28], v[29], v[30],
     v[32]],
  );
  return merged;
}

export async function deleteRoutine(id: string): Promise<void> {
  await query("DELETE FROM routine_exceptions WHERE routine_id = $1", [id]);
  await query("DELETE FROM routines WHERE id = $1", [id]);
}

export async function setRoutineActive(
  id: string,
  active: boolean,
): Promise<RoutineRecord | null> {
  const existing = await getRoutineById(id);
  if (!existing) return null;
  return updateRoutine(id, { isActive: active });
}

export async function listAdminRoutines(
  filter: AdminListFilter,
): Promise<RoutineRecord[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(filter.status);
    conds.push(`status = $${params.length}`);
  }
  if (filter.q) {
    const p = `%${escapeLike(filter.q)}%`;
    params.push(p, p, p);
    conds.push(
      `(title ILIKE $${params.length - 2} ESCAPE '\\' OR organizer_name_manual ILIKE $${params.length - 1} ESCAPE '\\' OR venue_name ILIKE $${params.length} ESCAPE '\\')`,
    );
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await query(
    `SELECT * FROM routines ${where} ORDER BY updated_at DESC`,
    params,
  );
  return rows.map((r) => toRoutine(r));
}

export async function listPublishedRoutines(
  filter: PublishedRoutineFilter,
): Promise<RoutineRecord[]> {
  const rows = await query(
    "SELECT * FROM routines WHERE status = 'published' AND is_active = 1 ORDER BY title ASC",
  );
  return rows
    .map((r) => toRoutine(r, true))
    .filter((r) => {
      if (filter.city && r.city !== filter.city) return false;
      if (filter.district && r.district !== filter.district) return false;
      if (filter.category && r.category !== filter.category) return false;
      if (filter.weekday !== undefined) {
        if (r.pattern.kind === "monthly-date") return false;
        if (r.pattern.weekday !== filter.weekday) return false;
      }
      return true;
    });
}

export async function getPublishedRoutineBySlug(
  slug: string,
): Promise<RoutineRecord | null> {
  const row = await queryOne(
    "SELECT * FROM routines WHERE slug = $1 AND status = 'published' AND is_active = 1",
    [slug],
  );
  return row ? toRoutine(row, true) : null;
}

// ---------------------------------------------------------------------------
// Pengecualian
// ---------------------------------------------------------------------------

async function assertExceptionDate(
  routineId: string,
  date: string,
  excludeId?: string,
): Promise<RoutineRecord> {
  assertValidDateString(date, "pengecualian");
  const routine = await getRoutineById(routineId);
  if (!routine) {
    throw new Error("Jadwal rutin tidak ditemukan");
  }
  const dup = await queryOne(
    "SELECT id FROM routine_exceptions WHERE routine_id = $1 AND date = $2 AND id <> $3",
    [routineId, date, excludeId ?? ""],
  );
  if (dup) {
    throw new Error("Sudah ada pengecualian pada tanggal tersebut");
  }
  const occurrences = computeOccurrences(
    routine,
    [],
    `${date}T00:00:00+07:00`,
    500,
  );
  if (!occurrences.some((o) => o.date === date)) {
    throw new Error("Tanggal bukan kemunculan jadwal rutin");
  }
  return routine;
}

export async function createRoutineException(
  input: RoutineExceptionInput,
): Promise<RoutineExceptionRecord> {
  await assertExceptionDate(input.routineId, input.date);
  if (input.overrideStartTime != null) {
    assertValidTimeString(input.overrideStartTime, "override mulai");
  }
  const ts = nowISODateTime();
  const record: RoutineExceptionRecord = {
    ...input,
    id: randomUUID(),
    createdAt: ts,
    updatedAt: ts,
  };
  await query(
    `INSERT INTO routine_exceptions (id, routine_id, date, kind, note,
      override_venue_name, override_address, override_start_time,
      override_description, created_at, updated_at)
     VALUES (${placeholders(11)})`,
    [
      record.id, record.routineId, record.date, record.kind, record.note,
      record.overrideVenueName, record.overrideAddress,
      record.overrideStartTime, record.overrideDescription, record.createdAt,
      record.updatedAt,
    ],
  );
  return record;
}

export async function getRoutineExceptionById(
  id: string,
): Promise<RoutineExceptionRecord | null> {
  const row = await queryOne(
    "SELECT * FROM routine_exceptions WHERE id = $1",
    [id],
  );
  return row ? toException(row) : null;
}

export async function updateRoutineException(
  id: string,
  patch: Partial<RoutineExceptionInput>,
): Promise<RoutineExceptionRecord | null> {
  const existing = await getRoutineExceptionById(id);
  if (!existing) return null;
  const clean = definedOnly(patch);
  const merged: RoutineExceptionRecord = {
    ...existing,
    ...clean,
    id: existing.id,
    routineId: clean.routineId ?? existing.routineId,
    createdAt: existing.createdAt,
    updatedAt: nowISODateTime(),
  };
  await assertExceptionDate(merged.routineId, merged.date, existing.id);
  if (merged.overrideStartTime != null) {
    assertValidTimeString(merged.overrideStartTime, "override mulai");
  }
  await query(
    `UPDATE routine_exceptions SET routine_id=$1, date=$2, kind=$3, note=$4,
      override_venue_name=$5, override_address=$6, override_start_time=$7,
      override_description=$8, updated_at=$9 WHERE id=$10`,
    [
      merged.routineId, merged.date, merged.kind, merged.note,
      merged.overrideVenueName, merged.overrideAddress,
      merged.overrideStartTime, merged.overrideDescription, merged.updatedAt,
      id,
    ],
  );
  return merged;
}

export async function deleteRoutineException(id: string): Promise<void> {
  await query("DELETE FROM routine_exceptions WHERE id = $1", [id]);
}

export async function listRoutineExceptions(
  routineId: string,
): Promise<RoutineExceptionRecord[]> {
  const rows = await query(
    "SELECT * FROM routine_exceptions WHERE routine_id = $1 ORDER BY date ASC",
    [routineId],
  );
  return rows.map(toException);
}

// ---------------------------------------------------------------------------
// Umum
// ---------------------------------------------------------------------------

export async function listKnownDistricts(city: string): Promise<string[]> {
  const found = new Set<string>();
  const ev = await query(
    "SELECT DISTINCT district FROM events WHERE city = $1",
    [city],
  );
  for (const r of ev) found.add(str(r.district));
  const rt = await query(
    "SELECT DISTINCT district FROM routines WHERE city = $1",
    [city],
  );
  for (const r of rt) found.add(str(r.district));
  const mj = await query(
    "SELECT DISTINCT base_district AS district FROM majelis WHERE city = $1 AND base_district IS NOT NULL",
    [city],
  );
  for (const r of mj) found.add(str(r.district));
  return [...found]
    .filter((d) => d.trim() !== "")
    .sort((a, b) => a.localeCompare(b));
}
