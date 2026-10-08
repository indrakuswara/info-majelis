// Detail publik gabungan (plan Task 12; spec §9.5–§9.6):
// - tanpa ?tanggal: event sekali jalan menurut slug; bila slug bukan
//   event terbit, dicoba sebagai detail jadwal rutin terbit+aktif.
// - dengan ?tanggal=YYYY-MM-DD: satu kemunculan dari slug rutin.
//   Tanggal harus tepat merupakan kemunculan pola. Kemunculan libur
//   bukan acara yang dapat dibuka sehingga menghasilkan 404; libur
//   tetap ditampilkan bertanda pada daftar kemunculan di detail rutin.
// Semua data berasal dari getter/list repository published-only.

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  EventDetail,
  type EventDetailData,
  type EventDetailOrganizer,
} from "../../../components/public/EventDetail.tsx";
import {
  assertValidDateString,
  ensureSchema,
  eventEndTs,
  eventStartTs,
  getPublishedEventBySlug,
  getPublishedRoutineBySlug,
  listPublishedMajelis,
  listRoutineExceptions,
  parseISODateTime,
} from "../../../lib/db.ts";
import type {
  EventRecord,
  MajelisRecord,
  Occurrence,
  RoutineExceptionRecord,
  RoutineRecord,
  ScheduleCommonFields,
} from "../../../lib/domain.ts";
import {
  formatJamRange,
  formatTanggal,
  formatTanggalSingkat,
  wibTodayISODate,
} from "../../../lib/format.ts";
import { computeOccurrences, describePattern } from "../../../lib/recurrence.ts";
import { buildMapsUrl } from "../../../lib/share.ts";
import { nowWibISO } from "../../../lib/utils.ts";

export const instant = false;

const DAY_MS = 86_400_000;

type OrganizerSource = Pick<
  ScheduleCommonFields,
  "organizerMajelisId" | "organizerNameManual"
>;

function resolveOrganizer(
  record: OrganizerSource,
  majelisById: Map<string, MajelisRecord>,
): EventDetailOrganizer | null {
  if (record.organizerMajelisId) {
    const majelis = majelisById.get(record.organizerMajelisId);
    if (majelis) {
      return {
        name: majelis.name,
        href: `/majelis/${majelis.slug}`,
        logoUrl: majelis.logoUrl,
      };
    }
    // Profil tertaut yang tidak terbit tidak boleh dibocorkan namanya.
    return null;
  }
  return record.organizerNameManual
    ? { name: record.organizerNameManual }
    : null;
}

function audienceLabel(
  audience: ScheduleCommonFields["audience"],
): string | null {
  if (audience === "ikhwan") return "Ikhwan";
  if (audience === "akhwat") return "Akhwat";
  return null;
}

function dayDifference(fromDate: string, toDate: string): number {
  const parse = (date: string): number => {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(toDate) - parse(fromDate)) / DAY_MS);
}

function relativeLabel(
  date: string,
  today: string,
  status: "upcoming" | "ongoing" | "finished",
): string | null {
  if (status === "ongoing") return "Sedang berlangsung";
  if (status === "finished") return "Sudah selesai";
  const diff = dayDifference(today, date);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Besok";
  if (diff > 1) return `${diff} hari lagi`;
  return null;
}

function latestUpdatedAt(values: string[]): string {
  return [...values].sort().at(-1) ?? values[0] ?? "";
}

function eventData(
  event: EventRecord,
  organizer: EventDetailOrganizer | null,
  nowISO: string,
): EventDetailData {
  const nowTs = parseISODateTime(nowISO);
  const startTs = eventStartTs(event);
  const endTs = eventEndTs(event);
  const status =
    nowTs < startTs ? "upcoming" : nowTs <= endTs ? "ongoing" : "finished";
  const statusLabel =
    status === "upcoming"
      ? "Mendatang"
      : status === "ongoing"
        ? "Sedang Berlangsung"
        : "Sudah Selesai";
  const dateLabel =
    event.endDate && event.endDate !== event.startDate
      ? `${formatTanggal(event.startDate)} – ${formatTanggalSingkat(event.endDate)}`
      : formatTanggal(event.startDate);

  return {
    title: event.title,
    category: event.category,
    posterUrl: event.posterUrl,
    fallbackDate: event.startDate,
    dateLabel,
    timeLabel: formatJamRange(event.startTime, event.endTime),
    statusLabel,
    statusTone: status,
    relativeLabel: relativeLabel(event.startDate, wibTodayISODate(), status),
    venueName: event.venueName,
    address: event.address,
    district: event.district,
    city: event.city,
    organizer,
    speakers: event.speakers,
    audienceLabel: audienceLabel(event.audience),
    description: event.description,
    extraInfo: event.extraInfo,
    liveStreamUrl: event.liveStreamUrl,
    contact: event.contact,
    libraryUrl: event.libraryUrl,
    updatedAt: event.updatedAt,
    canonicalPath: `/acara/${event.slug}`,
    mapsUrl: buildMapsUrl({
      mapsUrl: event.mapsUrl,
      venueName: event.venueName,
      address: event.address,
      district: event.district,
      city: event.city,
    }),
  };
}

function routineNextMapsUrl(
  routine: RoutineRecord,
  next: Occurrence | null,
): string {
  const specialLocationChanged =
    next?.exceptionKind === "edisi-spesial" &&
    (next.venueName !== routine.venueName || next.address !== routine.address);
  return buildMapsUrl({
    mapsUrl: specialLocationChanged ? null : routine.mapsUrl,
    venueName: next?.venueName ?? routine.venueName,
    address: next?.address ?? routine.address,
    district: routine.district,
    city: routine.city,
  });
}

async function routineDetail(
  routine: RoutineRecord,
  organizer: EventDetailOrganizer | null,
  nowISO: string,
) {
  const exceptions = await listRoutineExceptions(routine.id);
  const exceptionsByDate = new Map(exceptions.map((e) => [e.date, e]));
  const listed = computeOccurrences(routine, exceptions, nowISO, 4, {
    includeSkipped: true,
  });
  const next = computeOccurrences(routine, exceptions, nowISO, 1)[0] ?? null;
  const listedDates = new Set(listed.map((o) => o.date));
  const today = wibTodayISODate();
  const upcomingExceptions = exceptions
    .filter((e) => e.date >= today && !listedDates.has(e.date))
    .map((e) => ({
      date: e.date,
      kind: e.kind,
      note: e.note,
      description: e.kind === "edisi-spesial" ? e.overrideDescription : null,
    }));

  const effectiveParts: string[] = [];
  if (routine.effectiveFrom) {
    effectiveParts.push(`berlaku sejak ${formatTanggal(routine.effectiveFrom)}`);
  }
  if (routine.effectiveTo) {
    effectiveParts.push(`sampai ${formatTanggal(routine.effectiveTo)}`);
  }

  const data: EventDetailData = {
    title: routine.title,
    category: routine.category,
    posterUrl: routine.posterUrl,
    fallbackDate: next?.date ?? null,
    dateLabel: next
      ? formatTanggal(next.date)
      : "Belum ada jadwal berikutnya yang terkonfirmasi",
    timeLabel: next
      ? formatJamRange(next.startTime, routine.endTime)
      : formatJamRange(routine.startTime, routine.endTime),
    statusLabel: "Jadwal Rutin Aktif",
    statusTone: "routine",
    relativeLabel: next
      ? relativeLabel(next.date, today, next.isOngoing ? "ongoing" : "upcoming")
      : null,
    patternLabel: describePattern(routine.pattern, {
      startTime: routine.startTime,
    }),
    venueName: next?.venueName ?? routine.venueName,
    address: next?.address ?? routine.address,
    district: routine.district,
    city: routine.city,
    organizer,
    speakers: routine.speakers,
    audienceLabel: audienceLabel(routine.audience),
    description: routine.description,
    extraInfo: routine.extraInfo,
    liveStreamUrl: routine.liveStreamUrl,
    contact: routine.contact,
    libraryUrl: routine.libraryUrl,
    updatedAt: latestUpdatedAt([
      routine.updatedAt,
      ...exceptions.map((e) => e.updatedAt),
    ]),
    canonicalPath: `/acara/${routine.slug}`,
    mapsUrl: routineNextMapsUrl(routine, next),
    specialNote: routine.specialNote,
    effectiveLabel:
      effectiveParts.length > 0
        ? `Jadwal ini ${effectiveParts.join(" ")}.`
        : null,
    occurrences: listed.map((occurrence) => {
      const exception = exceptionsByDate.get(occurrence.date);
      return {
        date: occurrence.date,
        href:
          occurrence.exceptionKind === "libur"
            ? undefined
            : `/acara/${routine.slug}?tanggal=${occurrence.date}`,
        startTime: occurrence.startTime,
        endTime: routine.endTime,
        venueName: occurrence.venueName,
        address: occurrence.address,
        exceptionKind: occurrence.exceptionKind,
        note: occurrence.note,
        description:
          occurrence.exceptionKind === "edisi-spesial"
            ? (exception?.overrideDescription ?? null)
            : null,
        isOngoing: occurrence.isOngoing,
      };
    }),
    upcomingExceptions,
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/jadwal"
        className="text-sm font-medium text-emerald-800 underline underline-offset-4"
      >
        ← Semua jadwal rutin
      </Link>
      <EventDetail data={data} />
    </div>
  );
}

async function occurrenceDetail(
  routine: RoutineRecord,
  organizer: EventDetailOrganizer | null,
  tanggal: string,
  nowISO: string,
) {
  const exceptions = await listRoutineExceptions(routine.id);
  const occurrence = computeOccurrences(
    routine,
    exceptions,
    `${tanggal}T00:00:00+07:00`,
    1,
    { includeSkipped: true },
  )[0];

  if (
    !occurrence ||
    occurrence.date !== tanggal ||
    occurrence.exceptionKind === "libur"
  ) {
    notFound();
  }

  const exception: RoutineExceptionRecord | undefined = exceptions.find(
    (e) => e.date === tanggal,
  );
  const nowTs = parseISODateTime(nowISO);
  const startTs = parseISODateTime(occurrence.startISO);
  const endTs = occurrence.endISO
    ? parseISODateTime(occurrence.endISO)
    : startTs;
  const status =
    nowTs < startTs ? "upcoming" : nowTs <= endTs ? "ongoing" : "finished";
  const statusLabel =
    status === "upcoming"
      ? "Mendatang"
      : status === "ongoing"
        ? "Sedang Berlangsung"
        : "Sudah Selesai";
  const isSpecial = occurrence.exceptionKind === "edisi-spesial";
  const specialLocationChanged =
    isSpecial &&
    (occurrence.venueName !== routine.venueName ||
      occurrence.address !== routine.address);
  const crossesMidnight =
    routine.endTime !== null &&
    occurrence.endISO !== null &&
    occurrence.endISO.slice(0, 10) !== occurrence.date;
  const timeLabel =
    routine.endTime === null
      ? `${occurrence.startTime} WIB – selesai`
      : `${occurrence.startTime} – ${routine.endTime} WIB${crossesMidnight ? " (keesokan hari)" : ""}`;
  const overrideDescription = isSpecial
    ? (exception?.overrideDescription ?? null)
    : null;

  const data: EventDetailData = {
    title: routine.title,
    category: routine.category,
    posterUrl: routine.posterUrl,
    fallbackDate: occurrence.date,
    dateLabel: formatTanggal(occurrence.date),
    timeLabel,
    statusLabel,
    statusTone: status,
    relativeLabel: relativeLabel(
      occurrence.date,
      wibTodayISODate(),
      status,
    ),
    patternLabel: describePattern(routine.pattern, {
      startTime: routine.startTime,
    }),
    venueName: occurrence.venueName,
    address: occurrence.address,
    district: routine.district,
    city: routine.city,
    organizer,
    speakers: routine.speakers,
    audienceLabel: audienceLabel(routine.audience),
    description: overrideDescription ?? routine.description,
    descriptionLabel: overrideDescription
      ? "Deskripsi Edisi Spesial"
      : "Deskripsi",
    extraInfo: routine.extraInfo,
    liveStreamUrl: routine.liveStreamUrl,
    contact: routine.contact,
    libraryUrl: routine.libraryUrl,
    updatedAt: latestUpdatedAt([
      routine.updatedAt,
      ...(exception ? [exception.updatedAt] : []),
    ]),
    canonicalPath: `/acara/${routine.slug}?tanggal=${occurrence.date}`,
    mapsUrl: buildMapsUrl({
      mapsUrl: specialLocationChanged ? null : routine.mapsUrl,
      venueName: occurrence.venueName,
      address: occurrence.address,
      district: routine.district,
      city: routine.city,
    }),
    exceptionKind: occurrence.exceptionKind,
    exceptionNote:
      occurrence.note ?? (isSpecial ? routine.specialNote : null),
    // Pada edisi spesial tanpa catatan pengecualian sendiri, catatan
    // umum rutin sudah dipakai sebagai exceptionNote di atas — jangan
    // tampilkan teks yang sama dua kali sebagai "Catatan Khusus".
    specialNote:
      isSpecial && !occurrence.note
        ? null
        : routine.specialNote === occurrence.note
          ? null
          : routine.specialNote,
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/acara/${routine.slug}`}
        className="text-sm font-medium text-emerald-800 underline underline-offset-4"
      >
        ← Detail jadwal rutin
      </Link>
      <EventDetail data={data} />
    </div>
  );
}

export default async function AcaraDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tanggal?: string | string[] }>;
}) {
  await connection();
  await ensureSchema();
  const { slug } = await params;
  const { tanggal } = await searchParams;
  const nowISO = nowWibISO();
  const publishedMajelis = await listPublishedMajelis({});
  const majelisById = new Map(publishedMajelis.map((m) => [m.id, m]));

  if (tanggal !== undefined) {
    if (typeof tanggal !== "string" || tanggal === "") notFound();
    try {
      assertValidDateString(tanggal, "kemunculan");
    } catch {
      notFound();
    }
    const routine = await getPublishedRoutineBySlug(slug);
    if (!routine) notFound();
    return occurrenceDetail(
      routine,
      resolveOrganizer(routine, majelisById),
      tanggal,
      nowISO,
    );
  }

  const event = await getPublishedEventBySlug(slug);
  if (event) {
    return (
      <EventDetail
        data={eventData(event, resolveOrganizer(event, majelisById), nowISO)}
      />
    );
  }

  const routine = await getPublishedRoutineBySlug(slug);
  if (!routine) notFound();
  return routineDetail(
    routine,
    resolveOrganizer(routine, majelisById),
    nowISO,
  );
}
