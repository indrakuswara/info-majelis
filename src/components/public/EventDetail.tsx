// Tampilan detail publik bersama untuk event sekali jalan, jadwal
// rutin, dan satu kemunculan rutin (plan Task 12; spec §9.5–§9.6).
//
// Komponen ini murni presentasional: halaman yang memanggil wajib
// memberinya data yang sudah diselesaikan dari fungsi repository
// publik. Ia tidak menerima record mentah dan tidak pernah menerima
// sourceInfo, sehingga field internal admin tidak dapat bocor lewat
// komponen ini.

import Link from "next/link";
import { CATEGORY_STYLES, categoryLabel } from "../../lib/constants.ts";
import type { Category, ExceptionKind } from "../../lib/domain.ts";
import { formatTanggal, formatTanggalSingkat } from "../../lib/format.ts";
import { buildShareText } from "../../lib/share.ts";
import { MapsButton } from "./MapsButton.tsx";
import { ShareButtons } from "./ShareButtons.tsx";

export interface EventDetailOrganizer {
  name: string;
  href?: string;
  logoUrl?: string | null;
}

export interface EventDetailOccurrence {
  date: string;
  href?: string;
  startTime: string;
  endTime: string | null;
  venueName: string;
  address: string;
  exceptionKind: ExceptionKind | null;
  note: string | null;
  /** Deskripsi override edisi spesial pada tanggal ini, bila ada. */
  description: string | null;
  isOngoing: boolean;
}

export interface EventDetailException {
  date: string;
  kind: ExceptionKind;
  note: string | null;
  description: string | null;
}

export interface EventDetailData {
  title: string;
  category: Category;
  posterUrl: string | null;
  /** Tanggal yang ditonjolkan pada fallback; null untuk rutin tanpa kemunculan terkonfirmasi. */
  fallbackDate: string | null;
  dateLabel: string;
  timeLabel: string;
  statusLabel: string;
  statusTone: "upcoming" | "ongoing" | "finished" | "routine";
  relativeLabel?: string | null;
  patternLabel?: string | null;
  venueName: string;
  address: string;
  district: string;
  city: string;
  organizer: EventDetailOrganizer | null;
  speakers: string[];
  /** Hanya diisi bila perlu ditampilkan eksplisit (selain "umum"). */
  audienceLabel?: string | null;
  description: string | null;
  descriptionLabel?: string;
  extraInfo: string | null;
  liveStreamUrl: string | null;
  contact: string | null;
  libraryUrl: string | null;
  updatedAt: string;
  /** Path kanonis halaman ini untuk teks bagikan. */
  canonicalPath: string;
  /** URL rute yang sudah diselesaikan pemanggil (manual/override/fallback). */
  mapsUrl: string;
  exceptionKind?: ExceptionKind | null;
  exceptionNote?: string | null;
  specialNote?: string | null;
  effectiveLabel?: string | null;
  occurrences?: EventDetailOccurrence[];
  upcomingExceptions?: EventDetailException[];
}

const STATUS_CLASSES: Record<EventDetailData["statusTone"], string> = {
  upcoming: "bg-emerald-600 text-white",
  ongoing: "bg-red-600 text-white",
  finished: "bg-neutral-700 text-white",
  routine: "bg-neutral-800 text-white",
};

function fallbackDay(date: string | null): string {
  if (!date) return "–";
  const day = Number(date.slice(8, 10));
  return Number.isFinite(day) && day > 0 ? String(day) : "–";
}

function fallbackMonthYear(date: string | null): string {
  if (!date) return "Jadwal rutin";
  return formatTanggalSingkat(date);
}

export function EventDetail({ data }: { data: EventDetailData }) {
  const styles = CATEGORY_STYLES[data.category];
  const shareText = buildShareText({
    title: data.title,
    dateLabel: data.dateLabel,
    timeLabel: data.timeLabel,
    venueName: data.venueName,
    district: data.district,
    city: data.city,
    url: data.canonicalPath,
  });

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {data.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.posterUrl}
          alt={`Poster ${data.title}`}
          className="max-h-[32rem] w-full object-cover"
        />
      ) : (
        <div className={`p-6 text-white sm:p-8 ${styles.fallback}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-6xl font-bold leading-none">
                {fallbackDay(data.fallbackDate)}
              </div>
              <div className="mt-2 text-lg font-medium">
                {fallbackMonthYear(data.fallbackDate)}
              </div>
            </div>
            {data.organizer?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.organizer.logoUrl}
                alt=""
                className="h-14 w-14 rounded-full bg-white/90 object-cover"
              />
            ) : null}
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight">
            {data.title}
          </h1>
          {data.organizer ? (
            <p className="mt-2 text-white/90">{data.organizer.name}</p>
          ) : null}
          <p className="mt-1 text-sm text-white/85">
            {data.district}, {data.city}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6 p-5 sm:p-7">
        {data.posterUrl ? (
          <h1 className="text-3xl font-bold leading-tight text-neutral-950">
            {data.title}
          </h1>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles.chip}`}
          >
            {categoryLabel(data.category)}
          </span>
          {data.patternLabel ? (
            <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-white">
              Rutin
            </span>
          ) : null}
          {data.exceptionKind === "edisi-spesial" ? (
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950">
              Edisi Spesial
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[data.statusTone]}`}
          >
            {data.statusLabel}
          </span>
          {data.relativeLabel ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
              {data.relativeLabel}
            </span>
          ) : null}
        </div>

        {data.exceptionKind === "edisi-spesial" ? (
          <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <h2 className="font-semibold">Edisi Spesial</h2>
            <p className="mt-1 text-sm">
              {data.exceptionNote ??
                "Kemunculan ini memakai keterangan khusus dari penyelenggara."}
            </p>
          </section>
        ) : null}

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tanggal
            </dt>
            <dd className="mt-1 font-medium text-neutral-900">
              {data.dateLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Waktu
            </dt>
            <dd className="mt-1 font-medium text-neutral-900">
              {data.timeLabel}
            </dd>
          </div>
          {data.patternLabel ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Pola Jadwal
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {data.patternLabel}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tempat
            </dt>
            <dd className="mt-1 text-neutral-900">
              <span className="font-medium">{data.venueName}</span>
              <span className="mt-0.5 block text-sm text-neutral-600">
                {data.address} — {data.district}, {data.city}
              </span>
            </dd>
          </div>
          {data.organizer ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Penyelenggara
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {data.organizer.href ? (
                  <Link
                    href={data.organizer.href}
                    className="text-emerald-800 underline underline-offset-4"
                  >
                    {data.organizer.name}
                  </Link>
                ) : (
                  data.organizer.name
                )}
              </dd>
            </div>
          ) : null}
          {data.speakers.length > 0 ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Penceramah
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {data.speakers.join(", ")}
              </dd>
            </div>
          ) : null}
          {data.audienceLabel ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Untuk Siapa
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {data.audienceLabel}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row" aria-label="Aksi acara">
          <MapsButton href={data.mapsUrl} />
          <ShareButtons text={shareText} />
        </div>

        {data.description ? (
          <section>
            <h2 className="text-lg font-semibold text-neutral-950">
              {data.descriptionLabel ?? "Deskripsi"}
            </h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-neutral-700">
              {data.description}
            </p>
          </section>
        ) : null}

        {data.extraInfo ? (
          <section>
            <h2 className="text-lg font-semibold text-neutral-950">
              Info Tambahan
            </h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-neutral-700">
              {data.extraInfo}
            </p>
          </section>
        ) : null}

        {data.specialNote ? (
          <section className="rounded-xl bg-neutral-50 px-4 py-3">
            <h2 className="font-semibold text-neutral-950">Catatan Khusus</h2>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
              {data.specialNote}
            </p>
          </section>
        ) : null}

        {data.effectiveLabel ? (
          <p className="text-sm text-neutral-600">{data.effectiveLabel}</p>
        ) : null}

        {data.liveStreamUrl || data.libraryUrl ? (
          <section>
            <h2 className="text-lg font-semibold text-neutral-950">Tautan</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {data.liveStreamUrl ? (
                <li>
                  <a
                    href={data.liveStreamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-800 underline underline-offset-4"
                  >
                    Tonton live streaming
                  </a>
                </li>
              ) : null}
              {data.libraryUrl ? (
                <li>
                  <a
                    href={data.libraryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-800 underline underline-offset-4"
                  >
                    Bacaan di Perpustakaan
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {data.contact ? (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <h2 className="font-semibold text-emerald-950">Kontak Panitia</h2>
            <p className="mt-1 whitespace-pre-line text-emerald-950">
              {data.contact}
            </p>
            <p className="mt-1 text-xs text-emerald-900">
              Kontak ini ditampilkan publik sesuai data yang diberikan
              panitia.
            </p>
          </section>
        ) : null}

        {data.occurrences && data.occurrences.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-neutral-950">
              Kemunculan Berikutnya
            </h2>
            <ol className="mt-3 space-y-3">
              {data.occurrences.map((occurrence) => (
                <li
                  key={occurrence.date}
                  className="rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {occurrence.href &&
                    occurrence.exceptionKind !== "libur" ? (
                      <Link
                        href={occurrence.href}
                        className="font-semibold text-emerald-800 underline underline-offset-4"
                      >
                        {formatTanggal(occurrence.date)}
                      </Link>
                    ) : (
                      <span className="font-semibold text-neutral-900">
                        {formatTanggal(occurrence.date)}
                      </span>
                    )}
                    {occurrence.exceptionKind === "libur" ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
                        Libur
                      </span>
                    ) : null}
                    {occurrence.exceptionKind === "edisi-spesial" ? (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">
                        Edisi Spesial
                      </span>
                    ) : null}
                    {occurrence.isOngoing ? (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        Sedang Berlangsung
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">
                    {occurrence.startTime} WIB
                    {occurrence.endTime
                      ? ` – ${occurrence.endTime} WIB`
                      : " – selesai"}{" "}
                    · {occurrence.venueName} — {occurrence.address}
                  </p>
                  {occurrence.note ? (
                    <p className="mt-1 text-sm text-neutral-600">
                      {occurrence.note}
                    </p>
                  ) : null}
                  {occurrence.description ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-neutral-700">
                      <span className="font-medium">
                        Deskripsi edisi spesial:
                      </span>{" "}
                      {occurrence.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {data.upcomingExceptions && data.upcomingExceptions.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold text-neutral-950">
              Pengecualian Mendatang
            </h2>
            <ul className="mt-3 space-y-3">
              {data.upcomingExceptions.map((exception) => (
                <li
                  key={exception.date}
                  className="rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <p className="font-medium text-neutral-900">
                    {formatTanggal(exception.date)} —{" "}
                    {exception.kind === "libur" ? "Libur" : "Edisi Spesial"}
                  </p>
                  {exception.note ? (
                    <p className="mt-1 text-sm text-neutral-600">
                      {exception.note}
                    </p>
                  ) : null}
                  {exception.description ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
                      {exception.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="border-t border-neutral-200 pt-4 text-sm text-neutral-500">
          Terakhir diperbarui: {formatTanggal(data.updatedAt)}
        </p>
      </div>
    </article>
  );
}
