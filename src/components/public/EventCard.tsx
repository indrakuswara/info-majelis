// Kartu agenda publik (plan Task 11; spec §9.2; redesign Serambi
// Task 5): dipakai di beranda, daftar acara, dan profil majelis untuk
// event sekali jalan maupun kemunculan jadwal rutin. Gaya Serambi:
// sel bersih tanpa bayangan di atas kertas — blok tanggal tabular
// (angka tanggal Fraunces zamrud + bulan + jam mulai), judul serif,
// pemisah dari garis `line` wadah grid. Poster tampil sebagai gambar
// kecil berbingkai garis di sisi kanan kartu; tanpa poster kartu
// tampil tipografis murni. Varian `featured` (item pertama grup
// terdekat di beranda): blok dua kolom — poster/blok tipografi
// gradasi zamrud 320px + badan — mengikuti mockup Arah 1.
//
// Penanda kategori: titik + teks berwarna dari CATEGORY_STYLES
// dipertahankan sebagai pembeda antar-kategori (pola yang sama
// dengan RoutineCard di halaman Jadwal, redesign Task 4); penanda
// lain dijinakkan ke palet Serambi — "Hari ini" blok zamrud solid,
// "Besok" & "Edisi Spesial" lencana emas pucat.

import Link from "next/link";
import { CATEGORY_STYLES, categoryLabel } from "../../lib/constants.ts";
import type { FeedItem } from "../../lib/feed.ts";
import {
  formatJamRange,
  formatTanggal,
  relativeDayLabel,
} from "../../lib/format.ts";
import { PosterLightbox } from "./PosterLightbox.tsx";

/** Nama bulan ringkas dari tanggal kalender, mis. "Okt". */
function monthShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "short",
  }).format(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)));
}

/** Baris penanda di atas judul: kategori, rutin/spesial, label hari. */
function Badges({
  item,
  relLabel,
  isToday,
  featured = false,
}: {
  item: FeedItem;
  relLabel: string;
  isToday: boolean;
  featured?: boolean;
}) {
  const styles = CATEGORY_STYLES[item.category];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.08em]">
      {featured ? (
        <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-em px-2 py-0.5">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`}
          />
          <span className={styles.text}>{categoryLabel(item.category)}</span>
        </span>
      ) : (
        <span className={`inline-flex items-center gap-1.5 ${styles.text}`}>
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`}
          />
          {categoryLabel(item.category)}
        </span>
      )}
      {item.kind === "occurrence" ? (
        <span className="rounded-[2px] border border-line px-1.5 py-px text-muted">
          Rutin
        </span>
      ) : null}
      {item.isSpecialEdition ? (
        <span className="rounded-[2px] border border-gold bg-[#f7ecd2] px-1.5 py-px text-[#8a6410]">
          Edisi Spesial
        </span>
      ) : null}
      {relLabel ? (
        isToday ? (
          <span className="rounded-[2px] bg-em px-1.5 py-0.5 text-paper">
            {relLabel}
          </span>
        ) : (
          <span className="rounded-[2px] border border-gold bg-[#f7ecd2] px-1.5 py-px text-[#8a6410]">
            {relLabel}
          </span>
        )
      ) : null}
      {item.isOngoing ? (
        <span className="text-em">Sedang Berlangsung</span>
      ) : null}
    </div>
  );
}

/** Baris fakta di bawah judul: tanggal/jam, pola, tempat, penyelenggara. */
function MetaLines({ item }: { item: FeedItem }) {
  return (
    <>
      <p className="mt-1 text-sm text-muted">
        {formatTanggal(item.date)} ·{" "}
        {formatJamRange(item.startTime, item.endTime)}
      </p>
      {item.kind === "occurrence" && item.patternLabel ? (
        <p className="text-sm text-muted">{item.patternLabel}</p>
      ) : null}

      <p className="mt-1 text-sm text-muted">
        <span className="font-medium text-ink">{item.venueName}</span>
        <span>
          {" "}
          — {item.district}, {item.city}
        </span>
      </p>

      {item.organizerName ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          {item.organizerLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.organizerLogoUrl}
              alt=""
              className="h-5 w-5 flex-none rounded-[2px] border border-line object-cover"
            />
          ) : null}
          Penyelenggara: {item.organizerName}
        </p>
      ) : null}
      {item.isSpecialEdition && item.specialNote ? (
        <p className="mt-1 text-sm italic text-[#8a6410]">
          {item.specialNote}
        </p>
      ) : null}
    </>
  );
}

export function EventCard({
  item,
  todayIso,
  featured = false,
}: {
  item: FeedItem;
  todayIso: string;
  featured?: boolean;
}) {
  const relLabel = relativeDayLabel(item.date, todayIso);
  const isToday = relLabel === "Hari ini";
  const dayNumber = String(Number(item.date.slice(8, 10)));

  if (featured) {
    return (
      <article className="border border-line bg-ivory lg:grid lg:grid-cols-[320px_1fr]">
        {item.posterUrl ? (
          <PosterLightbox
            src={item.posterUrl}
            alt={`Poster ${item.title}`}
            wrapperClassName="h-[380px] w-full bg-gradient-to-br from-em2 to-em sm:h-[440px] lg:h-full lg:min-h-[300px]"
            imgClassName="h-full w-full object-contain"
          />
        ) : (
          <div className="flex min-h-60 flex-col justify-end bg-gradient-to-br from-em2 to-em p-6 lg:min-h-[300px]">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-goldsoft">
              {categoryLabel(item.category)}
            </div>
            <div className="mt-2 font-display text-[29px] font-semibold leading-[1.18] text-paper">
              {item.title}
            </div>
            <div className="mt-2.5 text-[13px] leading-relaxed text-[#cfe0d2]">
              {formatTanggal(item.date)} ·{" "}
              {formatJamRange(item.startTime, item.endTime)}
              <br />
              {item.venueName} — {item.district}, {item.city}
            </div>
          </div>
        )}

        <div className="p-6 sm:p-7">
          <Badges
            item={item}
            relLabel={relLabel}
            isToday={isToday}
            featured
          />
          <h3 className="mt-3 font-display text-[28px] font-semibold leading-[1.2] text-ink sm:text-[30px]">
            <Link href={item.href} className="hover:underline">
              {item.title}
            </Link>
          </h3>
          <MetaLines item={item} />

          {item.address ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {item.address}
            </p>
          ) : null}
          {item.speakers.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Penceramah:{" "}
              <span className="font-semibold text-ink">
                {item.speakers.join(", ")}
              </span>
            </p>
          ) : null}
          {item.description ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
              {item.description}
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="border-b border-r border-line bg-paper p-5 sm:p-6">
      <div className="flex gap-4">
        <div className="w-14 flex-none text-right">
          <div className="font-display text-[28px] font-semibold leading-none tabular-nums text-em">
            {dayNumber}
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {monthShort(item.date)} {item.date.slice(0, 4)}
          </div>
          <div
            className={`mt-1 text-xs font-bold tabular-nums ${
              isToday ? "text-em" : "text-ink"
            }`}
          >
            {item.startTime}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <Badges item={item} relLabel={relLabel} isToday={isToday} />

          <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink">
            <Link href={item.href} className="hover:underline">
              {item.title}
            </Link>
          </h3>

          <MetaLines item={item} />
        </div>

        {item.posterUrl ? (
          <PosterLightbox
            src={item.posterUrl}
            alt={`Poster ${item.title}`}
            wrapperClassName="flex-none self-start"
            imgClassName="h-28 w-20 rounded-[2px] border border-line object-cover sm:h-32 sm:w-24"
          />
        ) : null}
      </div>
    </article>
  );
}
