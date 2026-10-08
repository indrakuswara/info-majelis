// Lapisan database Info Majelis (plan Task 4; spec §6 & §13.1).
//
// Facade dual-backend: bila env DATABASE_URL terisi, seluruh fungsi
// didelegasikan ke implementasi Postgres di db-pg.ts; bila tidak, dipakai
// implementasi SQLite (node:sqlite) di berkas ini dengan berkas lokal
// `.data/info-majelis.db` (dapat dioverride env INFO_MAJELIS_DB_PATH,
// dipakai test agar tidak menyentuh data dev).
//
// Aturan yang dijaga di lapisan ini:
// - Fungsi publik HANYA mengembalikan konten published (rutin juga harus
//   aktif), dan field sourceInfo selalu null pada hasil publik.
// - "Sudah lewat" untuk event diturunkan dari tanggal/waktu selesai
//   (endDate ?? startDate, endTime lintas tengah malam dihitung), tidak
//   pernah disimpan sebagai status.
// - Parameter tanggal/waktu yang masuk (nowISO, tanggal & jam record)
//   divalidasi format + rentang; input rusak melempar Error.

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  EventRecord,
  MajelisRecord,
  RoutineExceptionRecord,
  RoutineRecord,
} from "./domain.ts";
import { slugify, uniqueSlug } from "./slug.ts";
import { computeOccurrences } from "./recurrence.ts";
import * as pg from "./db-pg.ts";

// ---------------------------------------------------------------------------
// Tipe input & filter (dipakai facade, db-pg, dan task-task berikutnya)
// ---------------------------------------------------------------------------

export type MajelisInput = Omit<
  MajelisRecord,
  "id" | "slug" | "createdAt" | "updatedAt"
> & { slug?: string };

export type EventInput = Omit<
  EventRecord,
  "id" | "slug" | "createdAt" | "updatedAt"
> & { slug?: string };

export type RoutineInput = Omit<
  RoutineRecord,
  "id" | "slug" | "createdAt" | "updatedAt"
> & { slug?: string };

export type RoutineExceptionInput = Omit<
  RoutineExceptionRecord,
  "id" | "createdAt" | "updatedAt"
>;

export interface AdminListFilter {
  status?: string;
  q?: string;
}

export type UpcomingRange = "today" | "week" | "weekend" | "all";

export interface UpcomingFilter {
  nowISO: string;
  city?: string;
  district?: string;
  category?: string;
  range?: UpcomingRange;
  q?: string;
}

export interface ArchiveFilter {
  q?: string;
  city?: string;
  category?: string;
}

export interface PublishedMajelisFilter {
  city?: string;
}

export interface PublishedRoutineFilter {
  city?: string;
  district?: string;
  category?: string;
  weekday?: number;
}

export interface SearchFilter {
  city?: string;
  category?: string;
}

export interface ManualOrganizerGroup {
  name: string;
  city: string;
  eventCount: number;
  routineCount: number;
}

export interface PromoteResult {
  majelis: MajelisRecord;
  linkedEvents: number;
  linkedRoutines: number;
}

// ---------------------------------------------------------------------------
// Validasi tanggal/waktu (internal — input rusak selalu Error)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function assertValidDateString(value: string, field: string): void {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) {
    throw new Error(`Tanggal ${field} tidak valid: ${value}`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Tanggal ${field} tidak valid: ${value}`);
  }
}

export function assertValidTimeString(value: string, field: string): void {
  const m = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    throw new Error(`Jam ${field} tidak valid: ${value}`);
  }
}

/** Parse ISO datetime WIB ke cap waktu sintetis (aritmetika UTC). */
export function parseISODateTime(value: string): number {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
      (value ?? "").trim(),
    );
  if (!m) {
    throw new Error(`Datetime tidak valid: ${value}`);
  }
  assertValidDateString(`${m[1]}-${m[2]}-${m[3]}`, "datetime");
  const hh = m[4] === undefined ? 0 : Number(m[4]);
  const mm = m[5] === undefined ? 0 : Number(m[5]);
  const ss = m[6] === undefined ? 0 : Number(m[6]);
  if (hh > 23 || mm > 59 || ss > 59) {
    throw new Error(`Datetime tidak valid: ${value}`);
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm, ss);
}

function assertValidISODateTime(value: string): number {
  return parseISODateTime(value);
}

/** Cap waktu sintetis dari tanggal "YYYY-MM-DD" + jam "HH:mm". */
function wallTs(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return Date.UTC(y, mo - 1, d, hh, mm);
}

/** Waktu selesai event sebagai cap waktu (aturan lintas tengah malam). */
export function eventEndTs(e: Pick<EventRecord, "startDate" | "endDate" | "startTime" | "endTime">): number {
  const endDate = e.endDate ?? e.startDate;
  if (e.endTime === null) {
    // Tanpa jam selesai: berlangsung sampai 23:59 hari terakhir.
    return wallTs(endDate, "23:59") + 59_999;
  }
  let ts = wallTs(endDate, e.endTime);
  if (e.endDate === null && e.endTime < e.startTime) {
    ts += DAY_MS; // selesai keesokan hari
  }
  return ts;
}

export function eventStartTs(e: Pick<EventRecord, "startDate" | "startTime">): number {
  return wallTs(e.startDate, e.startTime);
}

/** Interval [mulai, akhir) untuk filter range listPublishedUpcoming. */
export function rangeInterval(
  range: UpcomingRange,
  nowTs: number,
): { start: number; end: number } | null {
  if (range === "all") return null;
  const d = new Date(nowTs);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  switch (range) {
    case "today":
      return { start: dayStart, end: dayStart + DAY_MS };
    case "week":
      return { start: dayStart, end: dayStart + 7 * DAY_MS };
    case "weekend": {
      const dow = d.getUTCDay();
      const satOffset = dow === 0 ? -1 : dow === 6 ? 0 : 6 - dow;
      const sat = dayStart + satOffset * DAY_MS;
      return { start: sat, end: sat + 2 * DAY_MS };
    }
  }
}

export function validateScheduleDates(v: {
  startDate?: string;
  endDate?: string | null;
  startTime?: string;
  endTime?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}): void {
  if (v.startDate !== undefined) assertValidDateString(v.startDate, "mulai");
  if (v.endDate != null) assertValidDateString(v.endDate, "selesai");
  if (v.startTime !== undefined) assertValidTimeString(v.startTime, "mulai");
  if (v.endTime != null) assertValidTimeString(v.endTime, "selesai");
  if (v.effectiveFrom != null)
    assertValidDateString(v.effectiveFrom, "mulai berlaku");
  if (v.effectiveTo != null)
    assertValidDateString(v.effectiveTo, "akhir berlaku");
}

export function nowISODateTime(): string {
  return new Date().toISOString();
}

/** Cap waktu sintetis "sekarang" dalam komponen dinding WIB. */
export function wibNowTs(): number {
  const now = new Date();
  const wib = new Date(
    now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000,
  );
  return Date.UTC(
    wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(),
    wib.getUTCHours(), wib.getUTCMinutes(), wib.getUTCSeconds(),
  );
}

/** Buang kunci bernilai undefined dari patch update. */
export function definedOnly<T extends object>(patch: Partial<T>): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Skema (dipakai bersama: SQLite di sini, Postgres di db-pg.ts)
// ---------------------------------------------------------------------------

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS majelis (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    leader TEXT,
    logo_url TEXT,
    photo_url TEXT,
    base_address TEXT,
    base_district TEXT,
    base_maps_url TEXT,
    description TEXT,
    instagram_url TEXT,
    youtube_url TEXT,
    tiktok_url TEXT,
    website_url TEXT,
    contact TEXT,
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    venue_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    maps_url TEXT,
    lat REAL,
    lng REAL,
    description TEXT,
    poster_url TEXT,
    organizer_majelis_id TEXT,
    organizer_name_manual TEXT,
    speakers TEXT NOT NULL DEFAULT '[]',
    audience TEXT NOT NULL DEFAULT 'umum',
    live_stream_url TEXT,
    contact TEXT,
    extra_info TEXT,
    library_url TEXT,
    source_info TEXT,
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    pattern TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    effective_from TEXT,
    effective_to TEXT,
    special_note TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    venue_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    maps_url TEXT,
    lat REAL,
    lng REAL,
    description TEXT,
    poster_url TEXT,
    organizer_majelis_id TEXT,
    organizer_name_manual TEXT,
    speakers TEXT NOT NULL DEFAULT '[]',
    audience TEXT NOT NULL DEFAULT 'umum',
    live_stream_url TEXT,
    contact TEXT,
    extra_info TEXT,
    library_url TEXT,
    source_info TEXT,
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS routine_exceptions (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    note TEXT,
    override_venue_name TEXT,
    override_address TEXT,
    override_start_time TEXT,
    override_description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (routine_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

// ---------------------------------------------------------------------------
// Implementasi SQLite
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

let sqliteDb: DatabaseSync | null = null;

function getSqlite(): DatabaseSync {
  if (sqliteDb) return sqliteDb;
  const file =
    process.env.INFO_MAJELIS_DB_PATH ??
    path.join(process.cwd(), ".data", "info-majelis.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  sqliteDb = new DatabaseSync(file);
  ensureSchemaSqlite(sqliteDb);
  return sqliteDb;
}

function ensureSchemaSqlite(db: DatabaseSync): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
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

function parseSpeakers(v: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(str(v) || "[]");
    return Array.isArray(parsed) ? parsed.map((s) => String(s)) : [];
  } catch {
    return [];
  }
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

function takenSlugs(db: DatabaseSync, table: string): Set<string> {
  const rows = db.prepare(`SELECT slug FROM ${table}`).all() as Row[];
  return new Set(rows.map((r) => str(r.slug)));
}

function resolveSlug(
  db: DatabaseSync,
  table: string,
  provided: string | undefined,
  baseText: string,
  fallback: string,
  excludeSlug?: string,
): string {
  const base = slugify(provided?.trim() ? provided : baseText) || fallback;
  const taken = takenSlugs(db, table);
  if (excludeSlug) taken.delete(excludeSlug);
  return uniqueSlug(base, taken);
}

// --- Majelis (SQLite) -------------------------------------------------------

function createMajelisSqlite(input: MajelisInput): MajelisRecord {
  const db = getSqlite();
  const ts = nowISODateTime();
  const record: MajelisRecord = {
    ...input,
    id: randomUUID(),
    slug: resolveSlug(db, "majelis", input.slug, input.name, "majelis"),
    createdAt: ts,
    updatedAt: ts,
  };
  db.prepare(
    `INSERT INTO majelis (id, slug, name, city, leader, logo_url, photo_url,
      base_address, base_district, base_maps_url, description, instagram_url,
      youtube_url, tiktok_url, website_url, contact, status, created_by,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id, record.slug, record.name, record.city, record.leader,
    record.logoUrl, record.photoUrl, record.baseAddress, record.baseDistrict,
    record.baseMapsUrl, record.description, record.instagramUrl,
    record.youtubeUrl, record.tiktokUrl, record.websiteUrl, record.contact,
    record.status, record.createdBy, record.createdAt, record.updatedAt,
  );
  return record;
}

function getMajelisByIdSqlite(id: string): MajelisRecord | null {
  const db = getSqlite();
  const row = db.prepare("SELECT * FROM majelis WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? toMajelis(row) : null;
}

function updateMajelisSqlite(
  id: string,
  patch: Partial<MajelisInput>,
): MajelisRecord | null {
  const db = getSqlite();
  const existing = getMajelisByIdSqlite(id);
  if (!existing) return null;
  const clean = definedOnly(patch);
  const merged: MajelisRecord = {
    ...existing,
    ...clean,
    id: existing.id,
    slug:
      clean.slug !== undefined && clean.slug !== existing.slug
        ? resolveSlug(db, "majelis", clean.slug, clean.slug ?? "", "majelis", existing.slug)
        : existing.slug,
    createdAt: existing.createdAt,
    updatedAt: nowISODateTime(),
  };
  db.prepare(
    `UPDATE majelis SET slug=?, name=?, city=?, leader=?, logo_url=?,
      photo_url=?, base_address=?, base_district=?, base_maps_url=?,
      description=?, instagram_url=?, youtube_url=?, tiktok_url=?,
      website_url=?, contact=?, status=?, created_by=?, updated_at=?
     WHERE id=?`,
  ).run(
    merged.slug, merged.name, merged.city, merged.leader, merged.logoUrl,
    merged.photoUrl, merged.baseAddress, merged.baseDistrict,
    merged.baseMapsUrl, merged.description, merged.instagramUrl,
    merged.youtubeUrl, merged.tiktokUrl, merged.websiteUrl, merged.contact,
    merged.status, merged.createdBy, merged.updatedAt, id,
  );
  return merged;
}

function deleteMajelisSqlite(id: string): void {
  const db = getSqlite();
  const ts = nowISODateTime();
  db.prepare(
    "UPDATE events SET organizer_majelis_id = NULL, updated_at = ? WHERE organizer_majelis_id = ?",
  ).run(ts, id);
  db.prepare(
    "UPDATE routines SET organizer_majelis_id = NULL, updated_at = ? WHERE organizer_majelis_id = ?",
  ).run(ts, id);
  db.prepare("DELETE FROM majelis WHERE id = ?").run(id);
}

function listAdminMajelisSqlite(filter: AdminListFilter): MajelisRecord[] {
  const db = getSqlite();
  const conds: string[] = [];
  const params: string[] = [];
  if (filter.status) {
    conds.push("status = ?");
    params.push(filter.status);
  }
  if (filter.q) {
    conds.push("(name LIKE ? ESCAPE '\\' OR leader LIKE ? ESCAPE '\\')");
    const p = `%${escapeLike(filter.q)}%`;
    params.push(p, p);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM majelis ${where} ORDER BY updated_at DESC`)
    .all(...params) as Row[];
  return rows.map(toMajelis);
}

function listPublishedMajelisSqlite(
  filter: PublishedMajelisFilter,
): MajelisRecord[] {
  const db = getSqlite();
  const conds = ["status = 'published'"];
  const params: string[] = [];
  if (filter.city) {
    conds.push("city = ?");
    params.push(filter.city);
  }
  const rows = db
    .prepare(
      `SELECT * FROM majelis WHERE ${conds.join(" AND ")} ORDER BY name ASC`,
    )
    .all(...params) as Row[];
  return rows.map(toMajelis);
}

function getPublishedMajelisBySlugSqlite(slug: string): MajelisRecord | null {
  const db = getSqlite();
  const row = db
    .prepare("SELECT * FROM majelis WHERE slug = ? AND status = 'published'")
    .get(slug) as Row | undefined;
  return row ? toMajelis(row) : null;
}

function listManualOrganizerNamesSqlite(): ManualOrganizerGroup[] {
  const db = getSqlite();
  const groups = new Map<string, ManualOrganizerGroup>();
  const evRows = db
    .prepare(
      `SELECT organizer_name_manual AS name, city, COUNT(*) AS n FROM events
       WHERE organizer_majelis_id IS NULL AND organizer_name_manual IS NOT NULL
         AND TRIM(organizer_name_manual) <> ''
       GROUP BY organizer_name_manual, city`,
    )
    .all() as Row[];
  for (const r of evRows) {
    const g = groups.get(`${str(r.name)}\n${str(r.city)}`) ?? {
      name: str(r.name), city: str(r.city), eventCount: 0, routineCount: 0,
    };
    g.eventCount = Number(r.n);
    groups.set(`${str(r.name)}\n${str(r.city)}`, g);
  }
  const rtRows = db
    .prepare(
      `SELECT organizer_name_manual AS name, city, COUNT(*) AS n FROM routines
       WHERE organizer_majelis_id IS NULL AND organizer_name_manual IS NOT NULL
         AND TRIM(organizer_name_manual) <> ''
       GROUP BY organizer_name_manual, city`,
    )
    .all() as Row[];
  for (const r of rtRows) {
    const k = `${str(r.name)}\n${str(r.city)}`;
    const g = groups.get(k) ?? {
      name: str(r.name), city: str(r.city), eventCount: 0, routineCount: 0,
    };
    g.routineCount = Number(r.n);
    groups.set(k, g);
  }
  return [...groups.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.city.localeCompare(b.city),
  );
}

function promoteManualOrganizerSqlite(
  name: string,
  city: string,
): PromoteResult {
  const db = getSqlite();
  const majelis = createMajelisSqlite({
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
  const ev = db
    .prepare(
      `UPDATE events SET organizer_majelis_id = ?, organizer_name_manual = NULL,
        updated_at = ? WHERE organizer_name_manual = ? AND city = ?`,
    )
    .run(majelis.id, ts, name, city);
  const rt = db
    .prepare(
      `UPDATE routines SET organizer_majelis_id = ?, organizer_name_manual = NULL,
        updated_at = ? WHERE organizer_name_manual = ? AND city = ?`,
    )
    .run(majelis.id, ts, name, city);
  return {
    majelis,
    linkedEvents: Number(ev.changes ?? 0),
    linkedRoutines: Number(rt.changes ?? 0),
  };
}

// --- Event (SQLite) -----------------------------------------------------------

const EVENT_COLUMNS = `id, slug, title, category, start_date, end_date,
  start_time, end_time, venue_name, address, city, district, maps_url, lat,
  lng, description, poster_url, organizer_majelis_id, organizer_name_manual,
  speakers, audience, live_stream_url, contact, extra_info, library_url,
  source_info, status, created_by, created_at, updated_at`;

function insertEventSqlite(db: DatabaseSync, e: EventRecord): void {
  db.prepare(
    `INSERT INTO events (${EVENT_COLUMNS})
     VALUES (${EVENT_COLUMNS.split(",").map(() => "?").join(", ")})`,
  ).run(
    e.id, e.slug, e.title, e.category, e.startDate, e.endDate, e.startTime,
    e.endTime, e.venueName, e.address, e.city, e.district, e.mapsUrl, e.lat,
    e.lng, e.description, e.posterUrl, e.organizerMajelisId,
    e.organizerNameManual, JSON.stringify(e.speakers), e.audience,
    e.liveStreamUrl, e.contact, e.extraInfo, e.libraryUrl, e.sourceInfo,
    e.status, e.createdBy, e.createdAt, e.updatedAt,
  );
}

function writeEventSqlite(db: DatabaseSync, e: EventRecord): void {
  db.prepare(
    `UPDATE events SET slug=?, title=?, category=?, start_date=?, end_date=?,
      start_time=?, end_time=?, venue_name=?, address=?, city=?, district=?,
      maps_url=?, lat=?, lng=?, description=?, poster_url=?,
      organizer_majelis_id=?, organizer_name_manual=?, speakers=?,
      audience=?, live_stream_url=?, contact=?, extra_info=?, library_url=?,
      source_info=?, status=?, created_by=?, updated_at=? WHERE id=?`,
  ).run(
    e.slug, e.title, e.category, e.startDate, e.endDate, e.startTime,
    e.endTime, e.venueName, e.address, e.city, e.district, e.mapsUrl, e.lat,
    e.lng, e.description, e.posterUrl, e.organizerMajelisId,
    e.organizerNameManual, JSON.stringify(e.speakers), e.audience,
    e.liveStreamUrl, e.contact, e.extraInfo, e.libraryUrl, e.sourceInfo,
    e.status, e.createdBy, e.updatedAt, e.id,
  );
}

function createEventSqlite(input: EventInput): EventRecord {
  validateScheduleDates(input);
  const db = getSqlite();
  const ts = nowISODateTime();
  const record: EventRecord = {
    ...input,
    id: randomUUID(),
    slug: resolveSlug(db, "events", input.slug, input.title, "event"),
    createdAt: ts,
    updatedAt: ts,
  };
  insertEventSqlite(db, record);
  return record;
}

function getEventRowSqlite(id: string): Row | undefined {
  const db = getSqlite();
  return db.prepare("SELECT * FROM events WHERE id = ?").get(id) as
    | Row
    | undefined;
}

function getEventByIdSqlite(id: string): EventRecord | null {
  const row = getEventRowSqlite(id);
  return row ? toEvent(row) : null;
}

function updateEventSqlite(
  id: string,
  patch: Partial<EventInput>,
): EventRecord | null {
  const db = getSqlite();
  const existing = getEventByIdSqlite(id);
  if (!existing) return null;
  const clean = definedOnly(patch);
  const merged: EventRecord = {
    ...existing,
    ...clean,
    id: existing.id,
    slug:
      clean.slug !== undefined && clean.slug !== existing.slug
        ? resolveSlug(db, "events", clean.slug, clean.slug ?? "", "event", existing.slug)
        : existing.slug,
    createdAt: existing.createdAt,
    updatedAt: nowISODateTime(),
  };
  validateScheduleDates(merged);
  writeEventSqlite(db, merged);
  return merged;
}

function deleteEventSqlite(id: string): void {
  const db = getSqlite();
  db.prepare("DELETE FROM events WHERE id = ?").run(id);
}

function listAdminEventsSqlite(filter: AdminListFilter): EventRecord[] {
  const db = getSqlite();
  const conds: string[] = [];
  const params: string[] = [];
  if (filter.status) {
    conds.push("status = ?");
    params.push(filter.status);
  }
  if (filter.q) {
    conds.push(
      "(title LIKE ? ESCAPE '\\' OR organizer_name_manual LIKE ? ESCAPE '\\' OR venue_name LIKE ? ESCAPE '\\')",
    );
    const p = `%${escapeLike(filter.q)}%`;
    params.push(p, p, p);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM events ${where} ORDER BY updated_at DESC`)
    .all(...params) as Row[];
  return rows.map((r) => toEvent(r));
}

function publishedEventRowsSqlite(): Row[] {
  const db = getSqlite();
  return db
    .prepare("SELECT * FROM events WHERE status = 'published'")
    .all() as Row[];
}

function matchesEventFilters(
  e: EventRecord,
  f: { city?: string; district?: string; category?: string; q?: string },
): boolean {
  if (f.city && e.city !== f.city) return false;
  if (f.district && e.district !== f.district) return false;
  if (f.category && e.category !== f.category) return false;
  return true;
}

function listPublishedUpcomingSqlite(filter: UpcomingFilter): EventRecord[] {
  const nowTs = assertValidISODateTime(filter.nowISO);
  const interval = rangeInterval(filter.range ?? "all", nowTs);
  return publishedEventRowsSqlite()
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

function listPublishedArchiveSqlite(filter: ArchiveFilter): EventRecord[] {
  const syntheticNow = wibNowTs();
  return publishedEventRowsSqlite()
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

function getPublishedEventBySlugSqlite(slug: string): EventRecord | null {
  const db = getSqlite();
  const row = db
    .prepare("SELECT * FROM events WHERE slug = ? AND status = 'published'")
    .get(slug) as Row | undefined;
  return row ? toEvent(row, true) : null;
}

function searchPublishedEventsSqlite(
  q: string,
  filter: SearchFilter,
): EventRecord[] {
  const db = getSqlite();
  const pattern = `%${escapeLike(q.toLowerCase())}%`;
  const conds: string[] = ["e.status = 'published'"];
  const params: string[] = [];
  if (filter.city) {
    conds.push("e.city = ?");
    params.push(filter.city);
  }
  if (filter.category) {
    conds.push("e.category = ?");
    params.push(filter.category);
  }
  // CATATAN: source_info sengaja TIDAK ikut dicari (spec §9.8).
  conds.push(
    `(LOWER(e.title) LIKE ? ESCAPE '\\' OR LOWER(e.speakers) LIKE ? ESCAPE '\\'
      OR LOWER(e.venue_name) LIKE ? ESCAPE '\\' OR LOWER(e.district) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(e.description, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(e.organizer_name_manual, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(m.name, '')) LIKE ? ESCAPE '\\')`,
  );
  params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  const rows = db
    .prepare(
      `SELECT e.* FROM events e
       LEFT JOIN majelis m ON m.id = e.organizer_majelis_id
       WHERE ${conds.join(" AND ")}
       ORDER BY e.start_date ASC, e.start_time ASC`,
    )
    .all(...params) as Row[];
  return rows.map((r) => toEvent(r, true));
}

// --- Jadwal Rutin (SQLite) ------------------------------------------------------

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

function createRoutineSqlite(input: RoutineInput): RoutineRecord {
  validateScheduleDates(input);
  const db = getSqlite();
  const ts = nowISODateTime();
  const record: RoutineRecord = {
    ...input,
    id: randomUUID(),
    slug: resolveSlug(db, "routines", input.slug, input.title, "rutin"),
    createdAt: ts,
    updatedAt: ts,
  };
  db.prepare(
    `INSERT INTO routines (${ROUTINE_COLUMNS})
     VALUES (${ROUTINE_COLUMNS.split(",").map(() => "?").join(", ")})`,
  ).run(...(routineValues(record) as never[]));
  return record;
}

function getRoutineByIdSqlite(id: string): RoutineRecord | null {
  const db = getSqlite();
  const row = db.prepare("SELECT * FROM routines WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? toRoutine(row) : null;
}

function writeRoutineSqlite(db: DatabaseSync, r: RoutineRecord): void {
  db.prepare(
    `UPDATE routines SET slug=?, title=?, category=?, pattern=?, start_time=?,
      end_time=?, effective_from=?, effective_to=?, special_note=?,
      is_active=?, venue_name=?, address=?, city=?, district=?, maps_url=?,
      lat=?, lng=?, description=?, poster_url=?, organizer_majelis_id=?,
      organizer_name_manual=?, speakers=?, audience=?, live_stream_url=?,
      contact=?, extra_info=?, library_url=?, source_info=?, status=?,
      created_by=?, updated_at=? WHERE id=?`,
  ).run(
    r.slug, r.title, r.category, JSON.stringify(r.pattern), r.startTime,
    r.endTime, r.effectiveFrom, r.effectiveTo, r.specialNote,
    r.isActive ? 1 : 0, r.venueName, r.address, r.city, r.district, r.mapsUrl,
    r.lat, r.lng, r.description, r.posterUrl, r.organizerMajelisId,
    r.organizerNameManual, JSON.stringify(r.speakers), r.audience,
    r.liveStreamUrl, r.contact, r.extraInfo, r.libraryUrl, r.sourceInfo,
    r.status, r.createdBy, r.updatedAt, r.id,
  );
}

function updateRoutineSqlite(
  id: string,
  patch: Partial<RoutineInput>,
): RoutineRecord | null {
  const db = getSqlite();
  const existing = getRoutineByIdSqlite(id);
  if (!existing) return null;
  const clean = definedOnly(patch);
  const merged: RoutineRecord = {
    ...existing,
    ...clean,
    id: existing.id,
    slug:
      clean.slug !== undefined && clean.slug !== existing.slug
        ? resolveSlug(db, "routines", clean.slug, clean.slug ?? "", "rutin", existing.slug)
        : existing.slug,
    createdAt: existing.createdAt,
    updatedAt: nowISODateTime(),
  };
  validateScheduleDates(merged);
  writeRoutineSqlite(db, merged);
  return merged;
}

function deleteRoutineSqlite(id: string): void {
  const db = getSqlite();
  db.prepare("DELETE FROM routine_exceptions WHERE routine_id = ?").run(id);
  db.prepare("DELETE FROM routines WHERE id = ?").run(id);
}

function setRoutineActiveSqlite(
  id: string,
  active: boolean,
): RoutineRecord | null {
  const existing = getRoutineByIdSqlite(id);
  if (!existing) return null;
  return updateRoutineSqlite(id, { isActive: active });
}

function listAdminRoutinesSqlite(filter: AdminListFilter): RoutineRecord[] {
  const db = getSqlite();
  const conds: string[] = [];
  const params: string[] = [];
  if (filter.status) {
    conds.push("status = ?");
    params.push(filter.status);
  }
  if (filter.q) {
    conds.push(
      "(title LIKE ? ESCAPE '\\' OR organizer_name_manual LIKE ? ESCAPE '\\' OR venue_name LIKE ? ESCAPE '\\')",
    );
    const p = `%${escapeLike(filter.q)}%`;
    params.push(p, p, p);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM routines ${where} ORDER BY updated_at DESC`)
    .all(...params) as Row[];
  return rows.map((r) => toRoutine(r));
}

function listPublishedRoutinesSqlite(
  filter: PublishedRoutineFilter,
): RoutineRecord[] {
  const db = getSqlite();
  const rows = db
    .prepare(
      "SELECT * FROM routines WHERE status = 'published' AND is_active = 1 ORDER BY title ASC",
    )
    .all() as Row[];
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

function getPublishedRoutineBySlugSqlite(slug: string): RoutineRecord | null {
  const db = getSqlite();
  const row = db
    .prepare(
      "SELECT * FROM routines WHERE slug = ? AND status = 'published' AND is_active = 1",
    )
    .get(slug) as Row | undefined;
  return row ? toRoutine(row, true) : null;
}

// --- Pengecualian (SQLite) -------------------------------------------------------

function assertExceptionDateSqlite(
  routineId: string,
  date: string,
  excludeId?: string,
): RoutineRecord {
  assertValidDateString(date, "pengecualian");
  const routine = getRoutineByIdSqlite(routineId);
  if (!routine) {
    throw new Error("Jadwal rutin tidak ditemukan");
  }
  const db = getSqlite();
  const dup = db
    .prepare(
      "SELECT id FROM routine_exceptions WHERE routine_id = ? AND date = ? AND id <> ?",
    )
    .get(routineId, date, excludeId ?? "") as Row | undefined;
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

function createRoutineExceptionSqlite(
  input: RoutineExceptionInput,
): RoutineExceptionRecord {
  assertExceptionDateSqlite(input.routineId, input.date);
  if (input.overrideStartTime != null) {
    assertValidTimeString(input.overrideStartTime, "override mulai");
  }
  const db = getSqlite();
  const ts = nowISODateTime();
  const record: RoutineExceptionRecord = {
    ...input,
    id: randomUUID(),
    createdAt: ts,
    updatedAt: ts,
  };
  db.prepare(
    `INSERT INTO routine_exceptions (id, routine_id, date, kind, note,
      override_venue_name, override_address, override_start_time,
      override_description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id, record.routineId, record.date, record.kind, record.note,
    record.overrideVenueName, record.overrideAddress,
    record.overrideStartTime, record.overrideDescription, record.createdAt,
    record.updatedAt,
  );
  return record;
}

function getExceptionByIdSqlite(id: string): RoutineExceptionRecord | null {
  const db = getSqlite();
  const row = db
    .prepare("SELECT * FROM routine_exceptions WHERE id = ?")
    .get(id) as Row | undefined;
  return row ? toException(row) : null;
}

function updateRoutineExceptionSqlite(
  id: string,
  patch: Partial<RoutineExceptionInput>,
): RoutineExceptionRecord | null {
  const existing = getExceptionByIdSqlite(id);
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
  assertExceptionDateSqlite(merged.routineId, merged.date, existing.id);
  if (merged.overrideStartTime != null) {
    assertValidTimeString(merged.overrideStartTime, "override mulai");
  }
  const db = getSqlite();
  db.prepare(
    `UPDATE routine_exceptions SET routine_id=?, date=?, kind=?, note=?,
      override_venue_name=?, override_address=?, override_start_time=?,
      override_description=?, updated_at=? WHERE id=?`,
  ).run(
    merged.routineId, merged.date, merged.kind, merged.note,
    merged.overrideVenueName, merged.overrideAddress,
    merged.overrideStartTime, merged.overrideDescription, merged.updatedAt,
    id,
  );
  return merged;
}

function deleteRoutineExceptionSqlite(id: string): void {
  const db = getSqlite();
  db.prepare("DELETE FROM routine_exceptions WHERE id = ?").run(id);
}

function listRoutineExceptionsSqlite(
  routineId: string,
): RoutineExceptionRecord[] {
  const db = getSqlite();
  const rows = db
    .prepare(
      "SELECT * FROM routine_exceptions WHERE routine_id = ? ORDER BY date ASC",
    )
    .all(routineId) as Row[];
  return rows.map(toException);
}

// --- Umum (SQLite) -----------------------------------------------------------------

function listKnownDistrictsSqlite(city: string): string[] {
  const db = getSqlite();
  const found = new Set<string>();
  const ev = db
    .prepare("SELECT DISTINCT district FROM events WHERE city = ?")
    .all(city) as Row[];
  for (const r of ev) found.add(str(r.district));
  const rt = db
    .prepare("SELECT DISTINCT district FROM routines WHERE city = ?")
    .all(city) as Row[];
  for (const r of rt) found.add(str(r.district));
  const mj = db
    .prepare(
      "SELECT DISTINCT base_district AS district FROM majelis WHERE city = ? AND base_district IS NOT NULL",
    )
    .all(city) as Row[];
  for (const r of mj) found.add(str(r.district));
  return [...found].filter((d) => d.trim() !== "").sort((a, b) =>
    a.localeCompare(b),
  );
}

// ---------------------------------------------------------------------------
// Facade — memilih backend dari DATABASE_URL
// ---------------------------------------------------------------------------

function isPgBackend(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureSchema(): Promise<void> {
  if (isPgBackend()) return pg.ensureSchema();
  ensureSchemaSqlite(getSqlite());
}

export async function createMajelis(
  input: MajelisInput,
): Promise<MajelisRecord> {
  if (isPgBackend()) return pg.createMajelis(input);
  return createMajelisSqlite(input);
}

export async function updateMajelis(
  id: string,
  patch: Partial<MajelisInput>,
): Promise<MajelisRecord | null> {
  if (isPgBackend()) return pg.updateMajelis(id, patch);
  return updateMajelisSqlite(id, patch);
}

export async function deleteMajelis(id: string): Promise<void> {
  if (isPgBackend()) return pg.deleteMajelis(id);
  deleteMajelisSqlite(id);
}

export async function getMajelisById(
  id: string,
): Promise<MajelisRecord | null> {
  if (isPgBackend()) return pg.getMajelisById(id);
  return getMajelisByIdSqlite(id);
}

export async function listAdminMajelis(
  filter: AdminListFilter,
): Promise<MajelisRecord[]> {
  if (isPgBackend()) return pg.listAdminMajelis(filter);
  return listAdminMajelisSqlite(filter);
}

export async function listPublishedMajelis(
  filter: PublishedMajelisFilter,
): Promise<MajelisRecord[]> {
  if (isPgBackend()) return pg.listPublishedMajelis(filter);
  return listPublishedMajelisSqlite(filter);
}

export async function getPublishedMajelisBySlug(
  slug: string,
): Promise<MajelisRecord | null> {
  if (isPgBackend()) return pg.getPublishedMajelisBySlug(slug);
  return getPublishedMajelisBySlugSqlite(slug);
}

export async function listManualOrganizerNames(): Promise<
  ManualOrganizerGroup[]
> {
  if (isPgBackend()) return pg.listManualOrganizerNames();
  return listManualOrganizerNamesSqlite();
}

export async function promoteManualOrganizer(
  name: string,
  city: string,
): Promise<PromoteResult> {
  if (isPgBackend()) return pg.promoteManualOrganizer(name, city);
  return promoteManualOrganizerSqlite(name, city);
}

export async function createEvent(input: EventInput): Promise<EventRecord> {
  if (isPgBackend()) return pg.createEvent(input);
  return createEventSqlite(input);
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput>,
): Promise<EventRecord | null> {
  if (isPgBackend()) return pg.updateEvent(id, patch);
  return updateEventSqlite(id, patch);
}

export async function deleteEvent(id: string): Promise<void> {
  if (isPgBackend()) return pg.deleteEvent(id);
  deleteEventSqlite(id);
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  if (isPgBackend()) return pg.getEventById(id);
  return getEventByIdSqlite(id);
}

export async function listAdminEvents(
  filter: AdminListFilter,
): Promise<EventRecord[]> {
  if (isPgBackend()) return pg.listAdminEvents(filter);
  return listAdminEventsSqlite(filter);
}

export async function listPublishedUpcoming(
  filter: UpcomingFilter,
): Promise<EventRecord[]> {
  if (isPgBackend()) return pg.listPublishedUpcoming(filter);
  return listPublishedUpcomingSqlite(filter);
}

export async function listPublishedArchive(
  filter: ArchiveFilter,
): Promise<EventRecord[]> {
  if (isPgBackend()) return pg.listPublishedArchive(filter);
  return listPublishedArchiveSqlite(filter);
}

export async function getPublishedEventBySlug(
  slug: string,
): Promise<EventRecord | null> {
  if (isPgBackend()) return pg.getPublishedEventBySlug(slug);
  return getPublishedEventBySlugSqlite(slug);
}

export async function searchPublishedEvents(
  q: string,
  filter: SearchFilter,
): Promise<EventRecord[]> {
  if (isPgBackend()) return pg.searchPublishedEvents(q, filter);
  return searchPublishedEventsSqlite(q, filter);
}

export async function createRoutine(
  input: RoutineInput,
): Promise<RoutineRecord> {
  if (isPgBackend()) return pg.createRoutine(input);
  return createRoutineSqlite(input);
}

export async function updateRoutine(
  id: string,
  patch: Partial<RoutineInput>,
): Promise<RoutineRecord | null> {
  if (isPgBackend()) return pg.updateRoutine(id, patch);
  return updateRoutineSqlite(id, patch);
}

export async function deleteRoutine(id: string): Promise<void> {
  if (isPgBackend()) return pg.deleteRoutine(id);
  deleteRoutineSqlite(id);
}

export async function getRoutineById(
  id: string,
): Promise<RoutineRecord | null> {
  if (isPgBackend()) return pg.getRoutineById(id);
  return getRoutineByIdSqlite(id);
}

export async function setRoutineActive(
  id: string,
  active: boolean,
): Promise<RoutineRecord | null> {
  if (isPgBackend()) return pg.setRoutineActive(id, active);
  return setRoutineActiveSqlite(id, active);
}

export async function listAdminRoutines(
  filter: AdminListFilter,
): Promise<RoutineRecord[]> {
  if (isPgBackend()) return pg.listAdminRoutines(filter);
  return listAdminRoutinesSqlite(filter);
}

export async function listPublishedRoutines(
  filter: PublishedRoutineFilter,
): Promise<RoutineRecord[]> {
  if (isPgBackend()) return pg.listPublishedRoutines(filter);
  return listPublishedRoutinesSqlite(filter);
}

export async function getPublishedRoutineBySlug(
  slug: string,
): Promise<RoutineRecord | null> {
  if (isPgBackend()) return pg.getPublishedRoutineBySlug(slug);
  return getPublishedRoutineBySlugSqlite(slug);
}

export async function createRoutineException(
  input: RoutineExceptionInput,
): Promise<RoutineExceptionRecord> {
  if (isPgBackend()) return pg.createRoutineException(input);
  return createRoutineExceptionSqlite(input);
}

export async function updateRoutineException(
  id: string,
  patch: Partial<RoutineExceptionInput>,
): Promise<RoutineExceptionRecord | null> {
  if (isPgBackend()) return pg.updateRoutineException(id, patch);
  return updateRoutineExceptionSqlite(id, patch);
}

export async function deleteRoutineException(id: string): Promise<void> {
  if (isPgBackend()) return pg.deleteRoutineException(id);
  deleteRoutineExceptionSqlite(id);
}

export async function listRoutineExceptions(
  routineId: string,
): Promise<RoutineExceptionRecord[]> {
  if (isPgBackend()) return pg.listRoutineExceptions(routineId);
  return listRoutineExceptionsSqlite(routineId);
}

export async function listKnownDistricts(city: string): Promise<string[]> {
  if (isPgBackend()) return pg.listKnownDistricts(city);
  return listKnownDistrictsSqlite(city);
}
