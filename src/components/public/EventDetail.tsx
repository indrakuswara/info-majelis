// Tampilan detail publik bersama untuk event sekali jalan, jadwal
// rutin, dan satu kemunculan rutin (plan Task 12; spec §9.5–§9.6).
//
// Komponen ini murni presentasional: halaman yang memanggil wajib
// memberinya data yang sudah diselesaikan dari fungsi repository
// publik. Ia tidak menerima record mentah dan tidak pernah menerima
// sourceInfo, sehingga field internal admin tidak dapat bocor lewat
// komponen ini.
//
// Gaya Serambi (plan redesign Task 6): kepala dua kolom di desktop —
// poster berbingkai garis `line` (atau blok tipografi gradasi zamrud
// pengganti poster, pola featured EventCard) di kiri ±380px, info di
// kanan — baris fakta bergaya tabel bersih berbatas `line`, seksi di
// bawahnya dengan judul serif, dan dua tombol aksi tetap: Rute solid
// zamrud, Bagikan outline zamrud. Penanda kategori titik + teks warna
// dari CATEGORY_STYLES dipertahankan; aksen lain memakai palet
// Serambi ("Hari ini" blok zamrud, "Edisi Spesial" emas pucat).

import Link from "next/link";
import { CATEGORY_STYLES, categoryLabel } from "../../lib/constants.ts";
import type { Category, ExceptionKind } from "../../lib/domain.ts";
import { formatTanggal, formatTanggalSingkat } from "../../lib/format.ts";
import {
  absoluteUrl,
  buildEventJsonLd,
  serializeJsonLd,
} from "../../lib/seo.ts";
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
  /** Awal acara sebagai ISO datetime +07:00 untuk JSON-LD; null = tanpa JSON-LD. */
  startISO: string | null;
  /** Selesai acara sebagai ISO datetime +07:00; null = tanpa waktu selesai pasti. */
  endISO: string | null;
  /** URL rute yang sudah diselesaikan pemanggil (manual/override/fallback). */
  mapsUrl: string;
  exceptionKind?: ExceptionKind | null;
  exceptionNote?: string | null;
  specialNote?: string | null;
  effectiveLabel?: string | null;
  occurrences?: EventDetailOccurrence[];
  upcomingExceptions?: EventDetailException[];
}

const SECTION_HEADING =
  "border-b border-line pb-1.5 font-display text-lg font-semibold text-ink";
const DT_CLASS =
  "text-[11px] font-bold uppercase tracking-[0.12em] text-muted";

function StatusLabel({
  tone,
  children,
}: {
  tone: EventDetailData["statusTone"];
  children: string;
}) {
  if (tone === "ongoing") {
    return (
      <span className="rounded-[2px] bg-em px-1.5 py-0.5 font-bold text-paper">
        {children}
      </span>
    );
  }
  return (
    <span className={tone === "finished" ? "text-muted" : "text-ink"}>
      {children}
    </span>
  );
}

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
  const canonicalUrl = absoluteUrl(data.canonicalPath);
  const shareText = buildShareText({
    title: data.title,
    dateLabel: data.dateLabel,
    timeLabel: data.timeLabel,
    venueName: data.venueName,
    district: data.district,
    city: data.city,
    url: canonicalUrl,
  });
  const jsonLd = data.startISO
    ? serializeJsonLd(
        buildEventJsonLd({
          title: data.title,
          startISO: data.startISO,
          endISO: data.endISO,
          venueName: data.venueName,
          address: data.address,
          district: data.district,
          city: data.city,
          organizerName: data.organizer?.name ?? null,
          organizerUrl: data.organizer?.href ?? null,
          description: data.description,
          imageUrl: data.posterUrl,
          canonicalPath: data.canonicalPath,
        }),
      )
    : null;

  return (
    <article>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      ) : null}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-9">
        {data.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.posterUrl}
            alt={`Poster ${data.title}`}
            className="max-h-[32rem] w-full self-start rounded-[2px] border border-line object-cover lg:max-h-none"
          />
        ) : (
          <div className="flex min-h-64 flex-col justify-end self-start bg-gradient-to-br from-em2 to-em p-6 text-paper lg:min-h-[380px] lg:w-full">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-goldsoft">
              {categoryLabel(data.category)}
            </div>
            <div className="mt-3 font-display text-6xl font-semibold leading-none tabular-nums">
              {fallbackDay(data.fallbackDate)}
            </div>
            <div className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#cfe0d2]">
              {fallbackMonthYear(data.fallbackDate)}
            </div>
            <div className="mt-4 font-display text-2xl font-semibold leading-snug">
              {data.title}
            </div>
            <div className="mt-2 text-[13px] leading-relaxed text-[#cfe0d2]">
              {data.dateLabel} · {data.timeLabel}
              <br />
              {data.venueName} — {data.district}, {data.city}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.08em]">
              <span className={`inline-flex items-center gap-1.5 ${styles.text}`}>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`}
                />
                {categoryLabel(data.category)}
              </span>
              {data.patternLabel ? (
                <span className="rounded-[2px] border border-line px-1 py-px text-muted">
                  Rutin
                </span>
              ) : null}
              {data.exceptionKind === "edisi-spesial" ? (
                <span className="text-[#8a6410]">Edisi Spesial</span>
              ) : null}
              <StatusLabel tone={data.statusTone}>
                {data.statusLabel}
              </StatusLabel>
              {data.relativeLabel ? (
                data.relativeLabel === "Hari ini" ? (
                  <span className="rounded-[2px] bg-em px-1.5 py-0.5 text-paper">
                    {data.relativeLabel}
                  </span>
                ) : (
                  <span className="text-muted">{data.relativeLabel}</span>
                )
              ) : null}
            </div>

            <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.15] text-ink sm:text-4xl">
              {data.title}
            </h1>
            {data.organizer ? (
              <p className="mt-2.5 flex items-center gap-2.5 font-medium text-ink">
                {data.organizer.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.organizer.logoUrl}
                    alt=""
                    className="h-10 w-10 flex-none rounded-[2px] border border-line object-cover"
                  />
                ) : null}
                {data.organizer.name}
              </p>
            ) : null}
            <p className="mt-1.5 text-sm text-muted">
              {data.district}, {data.city}
            </p>
          </div>

          {data.exceptionKind === "edisi-spesial" ? (
            <section className="border-l-2 border-gold bg-[#f7ecd2] px-4 py-3 text-ink">
              <h2 className="font-display font-semibold">Edisi Spesial</h2>
              <p className="mt-1 text-sm">
                {data.exceptionNote ??
                  "Kemunculan ini memakai keterangan khusus dari penyelenggara."}
              </p>
            </section>
          ) : null}

          <dl className="grid gap-x-6 sm:grid-cols-2">
            <div className="border-t border-line py-3">
              <dt className={DT_CLASS}>Tanggal</dt>
              <dd className="mt-1 font-medium text-ink">{data.dateLabel}</dd>
            </div>
            <div className="border-t border-line py-3">
              <dt className={DT_CLASS}>Waktu</dt>
              <dd className="mt-1 font-medium tabular-nums text-ink">
                {data.timeLabel}
              </dd>
            </div>
            {data.patternLabel ? (
              <div className="border-t border-line py-3">
                <dt className={DT_CLASS}>Pola Jadwal</dt>
                <dd className="mt-1 font-medium text-ink">
                  {data.patternLabel}
                </dd>
              </div>
            ) : null}
            <div className="border-t border-line py-3">
              <dt className={DT_CLASS}>Tempat</dt>
              <dd className="mt-1 text-ink">
                <span className="font-medium">{data.venueName}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {data.address} — {data.district}, {data.city}
                </span>
              </dd>
            </div>
            {data.organizer ? (
              <div className="border-t border-line py-3">
                <dt className={DT_CLASS}>Penyelenggara</dt>
                <dd className="mt-1 font-medium text-ink">
                  {data.organizer.href ? (
                    <Link
                      href={data.organizer.href}
                      className="text-em underline underline-offset-4"
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
              <div className="border-t border-line py-3">
                <dt className={DT_CLASS}>Penceramah</dt>
                <dd className="mt-1 font-medium text-ink">
                  {data.speakers.join(", ")}
                </dd>
              </div>
            ) : null}
            {data.audienceLabel ? (
              <div className="border-t border-line py-3">
                <dt className={DT_CLASS}>Untuk Siapa</dt>
                <dd className="mt-1 font-medium text-ink">
                  {data.audienceLabel}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="flex flex-col gap-2 sm:flex-row" aria-label="Aksi acara">
            <MapsButton href={data.mapsUrl} />
            <ShareButtons title={data.title} text={shareText} url={canonicalUrl} />
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {data.description ? (
          <section>
            <h2 className={SECTION_HEADING}>
              {data.descriptionLabel ?? "Deskripsi"}
            </h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink">
              {data.description}
            </p>
          </section>
        ) : null}

        {data.extraInfo ? (
          <section>
            <h2 className={SECTION_HEADING}>Info Tambahan</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink">
              {data.extraInfo}
            </p>
          </section>
        ) : null}

        {data.specialNote ? (
          <section className="border-l-2 border-em bg-ivory px-4 py-3">
            <h2 className="font-display font-semibold text-ink">
              Catatan Khusus
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
              {data.specialNote}
            </p>
          </section>
        ) : null}

        {data.effectiveLabel ? (
          <p className="text-sm text-muted">{data.effectiveLabel}</p>
        ) : null}

        {data.liveStreamUrl || data.libraryUrl ? (
          <section>
            <h2 className={SECTION_HEADING}>Tautan</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {data.liveStreamUrl ? (
                <li>
                  <a
                    href={data.liveStreamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-em underline underline-offset-4"
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
                    className="font-medium text-em underline underline-offset-4"
                  >
                    Bacaan di Perpustakaan
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {data.contact ? (
          <section className="border-l-2 border-em bg-ivory px-4 py-3">
            <h2 className="font-display font-semibold text-em">
              Kontak Panitia
            </h2>
            <p className="mt-1 whitespace-pre-line text-ink">{data.contact}</p>
            <p className="mt-1 text-xs text-muted">
              Kontak ini ditampilkan publik sesuai data yang diberikan
              panitia.
            </p>
          </section>
        ) : null}

        {data.occurrences && data.occurrences.length > 0 ? (
          <section>
            <h2 className={SECTION_HEADING}>Kemunculan Berikutnya</h2>
            <ol className="divide-y divide-line">
              {data.occurrences.map((occurrence) => (
                <li key={occurrence.date} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {occurrence.href &&
                    occurrence.exceptionKind !== "libur" ? (
                      <Link
                        href={occurrence.href}
                        className="font-semibold text-ink underline underline-offset-4 hover:text-em"
                      >
                        {formatTanggal(occurrence.date)}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">
                        {formatTanggal(occurrence.date)}
                      </span>
                    )}
                    {occurrence.exceptionKind === "libur" ? (
                      <span className="rounded-[2px] border border-line bg-ivory px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                        Libur
                      </span>
                    ) : null}
                    {occurrence.exceptionKind === "edisi-spesial" ? (
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a6410]">
                        Edisi Spesial
                      </span>
                    ) : null}
                    {occurrence.isOngoing ? (
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-em">
                        Sedang Berlangsung
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm tabular-nums text-muted">
                    {occurrence.startTime} WIB
                    {occurrence.endTime
                      ? ` – ${occurrence.endTime} WIB`
                      : " – selesai"}{" "}
                    · {occurrence.venueName} — {occurrence.address}
                  </p>
                  {occurrence.note ? (
                    <p className="mt-1 text-sm text-muted">{occurrence.note}</p>
                  ) : null}
                  {occurrence.description ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-ink">
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
            <h2 className={SECTION_HEADING}>Pengecualian Mendatang</h2>
            <ul className="divide-y divide-line">
              {data.upcomingExceptions.map((exception) => (
                <li key={exception.date} className="py-3">
                  <p className="font-semibold text-ink">
                    {formatTanggal(exception.date)} —{" "}
                    {exception.kind === "libur" ? "Libur" : "Edisi Spesial"}
                  </p>
                  {exception.note ? (
                    <p className="mt-1 text-sm text-muted">{exception.note}</p>
                  ) : null}
                  {exception.description ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-ink">
                      {exception.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="border-t border-line pt-4 text-sm text-muted">
          Terakhir diperbarui: {formatTanggal(data.updatedAt)}
        </p>
      </div>
    </article>
  );
}
