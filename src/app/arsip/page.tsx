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
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900";
const labelClass =
  "block text-xs font-semibold uppercase tracking-wide text-neutral-500";

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
    <article className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {event.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.posterUrl}
          alt={`Poster ${event.title}`}
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className={`flex aspect-[4/3] flex-col justify-between p-5 text-white ${styles.fallback}`}>
          <span className="text-sm font-medium">{formatTanggal(event.startDate)}</span>
          <div>
            <div className="text-5xl font-bold leading-none">
              {String(Number(event.startDate.slice(8, 10)))}
            </div>
            {organizerName ? (
              <p className="mt-3 line-clamp-1 text-sm text-white/90">
                {organizerName}
              </p>
            ) : null}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles.chip}`}>
            {categoryLabel(event.category)}
          </span>
          <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-xs font-semibold text-white">
            Sudah Selesai
          </span>
        </div>
        <h3 className="text-base font-semibold leading-snug text-neutral-900">
          <Link href={href} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="text-sm text-neutral-700">
          {formatTanggal(event.startDate)} ·{" "}
          {formatJamRange(event.startTime, event.endTime)}
        </p>
        <p className="text-sm text-neutral-700">
          {event.venueName}
          <span className="text-neutral-500">
            {" "}
            — {event.district}, {event.city}
          </span>
        </p>
        {organizerName ? (
          <p className="text-sm text-neutral-500">
            Penyelenggara: {organizerName}
          </p>
        ) : null}
      </div>
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
      <div>
        <h1 className="text-2xl font-bold text-neutral-950">Arsip Acara</h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-neutral-600">
          Event terbit yang sudah selesai. Link langsung ke acara lama
          tetap dapat dibuka dari halaman detailnya.
        </p>
      </div>

      <form
        method="get"
        action="/arsip"
        className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
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
            className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Terapkan
          </button>
          <a
            href="/arsip"
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Atur Ulang
          </a>
          <span className="text-sm text-neutral-600" role="status">
            Menampilkan {events.length} acara
          </span>
        </div>
      </form>

      {events.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
          <h2 className="text-lg font-semibold text-neutral-900">
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
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-neutral-950">
                {monthLabel(month)}
              </h2>
              <span className="text-sm text-neutral-500">
                {monthEvents.length} acara
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
