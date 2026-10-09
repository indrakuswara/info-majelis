// Arsip publik (plan Task 12; spec §9.7): hanya event sekali jalan
// terbit yang sudah selesai, dari listPublishedArchive. Kemunculan
// rutin lampau sengaja tidak masuk arsip. Hasil dikelompokkan per
// bulan dan dapat dicari/difilter sederhana lewat query string.
//
// Presentasi Serambi (plan redesign Task 4): form pencarian/filter
// adalah form GET lokal berkelas akar `pageform`, dibungkus RailSlot
// agar tampil di rail desktop / bar mobile; daftar arsip tetap padat
// satu kolom per bulan dengan tanggal & judul serif Fraunces.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { RailSlot } from "../../components/public/RailSlot.tsx";
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
  "w-full rounded-[2px] border border-line bg-paper px-2.5 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-em focus:outline-none";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-[0.12em] text-muted";

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
        <div className="font-display text-[28px] font-semibold leading-none tabular-nums text-em">
          {String(Number(event.startDate.slice(8, 10)))}
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {monthLabel(event.startDate.slice(0, 7))}
        </div>
        <div className="mt-1 text-xs font-bold tabular-nums text-ink">
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
          <span className="text-muted">Sudah Selesai</span>
        </div>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink">
          <Link href={href} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          {formatTanggal(event.startDate)} ·{" "}
          {formatJamRange(event.startTime, event.endTime)}
        </p>
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-ink">
            {event.venueName}
          </span>{" "}
          — {event.district}, {event.city}
        </p>
        {organizerName ? (
          <p className="mt-1 text-sm text-muted">
            Penyelenggara: {organizerName}
          </p>
        ) : null}
      </div>

      {event.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.posterUrl}
          alt={`Poster ${event.title}`}
          className="h-28 w-20 flex-none self-start rounded-[2px] border border-line object-cover sm:h-32 sm:w-24"
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
      <div className="border-b border-line pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          Sudah Selesai
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
          Arsip Acara
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Event terbit yang sudah selesai. Link langsung ke acara lama
          tetap dapat dibuka dari halaman detailnya.
        </p>
      </div>

      {/* Filter tinggal di rail desktop / bar mobile lewat RailSlot;
          posisi di sini adalah fallback aliran konten tanpa JS. */}
      <RailSlot>
      <form
        method="get"
        action="/arsip"
        className="pageform flex flex-col gap-4"
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
        <div className="pageform-actions flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-[2px] bg-em px-5 py-2 text-xs font-bold uppercase tracking-wider text-paper hover:bg-em2"
          >
            Terapkan
          </button>
          <a
            href="/arsip"
            className="rounded-[2px] border border-em px-5 py-2 text-xs font-bold uppercase tracking-wider text-em hover:bg-ivory"
          >
            Atur Ulang
          </a>
          <span className="pageform-count text-sm text-muted" role="status">
            Menampilkan {events.length} acara
          </span>
        </div>
      </form>
      </RailSlot>

      {events.length === 0 ? (
        <section className="border border-dashed border-line px-5 py-10 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">
            Tidak ada arsip yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            {hasFilter
              ? "Belum ada event terbit yang sudah selesai dan cocok dengan pencarian atau filter."
              : "Belum ada event terbit yang sudah selesai."}
          </p>
        </section>
      ) : (
        [...grouped.entries()].map(([month, monthEvents]) => (
          <section key={month} aria-label={`Arsip ${monthLabel(month)}`}>
            <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
              <h2 className="font-display text-lg font-semibold text-em">
                {monthLabel(month)}
              </h2>
              <span className="text-sm text-muted">
                {monthEvents.length} acara
              </span>
            </div>
            <div className="divide-y divide-line">
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
