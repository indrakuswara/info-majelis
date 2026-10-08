// Arsip publik (plan Task 12; spec §9.7): hanya event sekali jalan
// terbit yang sudah selesai, dari listPublishedArchive. Kemunculan
// rutin lampau sengaja tidak masuk arsip. Hasil dikelompokkan per
// bulan dan dapat dicari/difilter sederhana lewat query string.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  CATEGORIES,
  CATEGORY_STYLES,
  REGIONS,
  categoryLabel,
} from "../../lib/constants.ts";
import {
  ensureSchema,
  listPublishedArchive,
  listPublishedMajelis,
} from "../../lib/db.ts";
import type { EventRecord } from "../../lib/domain.ts";
import { formatJamRange, formatTanggal } from "../../lib/format.ts";

export const instant = false;

export const metadata: Metadata = {
  title: "Arsip Acara",
  description: "Arsip event majelis terbit yang sudah selesai.",
};

interface ArsipSearchParams {
  q?: string;
  city?: string;
  category?: string;
}

const inputClass =
  "w-full rounded-none border-0 border-b border-neutral-400 bg-transparent px-0 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500";

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1, 12)));
}

function ArchiveCard({
  event,
  organizerName,
}: {
  event: EventRecord;
  organizerName: string | null;
}) {
  const styles = CATEGORY_STYLES[event.category];
  const href = `/acara/${event.slug}`;
  return (
    <article className="flex gap-4 py-4">
      <div className="w-14 flex-none text-right">
        <div className="text-2xl font-extrabold leading-none tabular-nums text-neutral-900">
          {String(Number(event.startDate.slice(8, 10)))}
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {monthLabel(event.startDate.slice(0, 7))}
        </div>
        <div className="mt-1 text-xs font-bold tabular-nums text-neutral-700">
          {event.startTime}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.08em]">
          <span className={`inline-flex items-center gap-1.5 ${styles.text}`}>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`}
            />
            {categoryLabel(event.category)}
          </span>
          <span className="text-neutral-500">Sudah Selesai</span>
        </div>
        <h3 className="mt-1.5 text-base font-bold leading-snug text-neutral-900">
          <Link href={href} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-neutral-600">
          {formatTanggal(event.startDate)} ·{" "}
          {formatJamRange(event.startTime, event.endTime)}
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">
            {event.venueName}
          </span>
          <span className="text-neutral-500">
            {" "}
            — {event.district}, {event.city}
          </span>
        </p>
        {organizerName ? (
          <p className="mt-1 text-sm text-neutral-500">
            Penyelenggara: {organizerName}
          </p>
        ) : null}
      </div>

      {event.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.posterUrl}
          alt={`Poster ${event.title}`}
          className="h-28 w-20 flex-none self-start rounded-[2px] object-cover sm:h-32 sm:w-24"
          loading="lazy"
        />
      ) : null}
    </article>
  );
}

export default async function ArsipPage({
  searchParams,
}: {
  searchParams: Promise<ArsipSearchParams>;
}) {
  await connection();
  await ensureSchema();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const city = REGIONS.includes(params.city ?? "") ? (params.city ?? "") : "";
  const category = CATEGORIES.some((c) => c.value === params.category)
    ? (params.category ?? "")
    : "";

  const [events, publishedMajelis] = await Promise.all([
    listPublishedArchive({
      q: q || undefined,
      city: city || undefined,
      category: category || undefined,
    }),
    listPublishedMajelis({}),
  ]);
  const majelisById = new Map(publishedMajelis.map((m) => [m.id, m]));

  const grouped = new Map<string, EventRecord[]>();
  for (const event of events) {
    const key = event.startDate.slice(0, 7);
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }
  const hasFilter = q !== "" || city !== "" || category !== "";

  return (
    <div className="flex flex-col gap-8">
      <div className="border-b-2 border-neutral-900 pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950">
          Arsip Acara
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-neutral-600">
          Event terbit yang sudah selesai. Link langsung ke acara lama
          tetap dapat dibuka dari halaman detailnya.
        </p>
      </div>

      <form
        method="get"
        action="/arsip"
        className="border-b border-[#e3e0d5] border-t-[3px] border-t-neutral-900 py-4"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="arsip-q" className={labelClass}>
              Cari arsip
            </label>
            <input
              id="arsip-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Judul, tempat, atau kecamatan"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="arsip-city" className={labelClass}>
              Kota/Kabupaten
            </label>
            <select id="arsip-city" name="city" defaultValue={city} className={inputClass}>
              <option value="">Semua kota/kabupaten</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="arsip-category" className={labelClass}>
              Kategori
            </label>
            <select id="arsip-category" name="category" defaultValue={category} className={inputClass}>
              <option value="">Semua kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-none bg-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-700"
          >
            Terapkan
          </button>
          <a
            href="/arsip"
            className="rounded-none border border-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-neutral-900 hover:bg-neutral-100"
          >
            Atur Ulang
          </a>
          <span className="text-sm text-neutral-600" role="status">
            Menampilkan {events.length} acara
          </span>
        </div>
      </form>

      {events.length === 0 ? (
        <section className="border border-dashed border-neutral-400 px-5 py-10 text-center">
          <h2 className="text-lg font-bold text-neutral-900">
            Tidak ada arsip yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
            {hasFilter
              ? "Belum ada event terbit yang sudah selesai dan cocok dengan pencarian atau filter di atas."
              : "Belum ada event terbit yang sudah selesai."}
          </p>
        </section>
      ) : (
        [...grouped.entries()].map(([month, monthEvents]) => (
          <section key={month} aria-label={`Arsip ${monthLabel(month)}`}>
            <div className="flex items-baseline justify-between gap-2 border-b-2 border-neutral-900 pb-1.5">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-neutral-950">
                {monthLabel(month)}
              </h2>
              <span className="text-sm text-neutral-500">
                {monthEvents.length} acara
              </span>
            </div>
            <div className="divide-y divide-[#e3e0d5]">
              {monthEvents.map((event) => (
                <ArchiveCard
                  key={event.id}
                  event={event}
                  organizerName={
                    event.organizerMajelisId
                      ? (majelisById.get(event.organizerMajelisId)?.name ??
                        null)
                      : event.organizerNameManual
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
