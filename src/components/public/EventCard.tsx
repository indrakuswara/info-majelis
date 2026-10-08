// Baris agenda publik (plan Task 11; spec §9.2): dipakai di beranda,
// daftar acara, dan profil majelis untuk event sekali jalan maupun
// kemunculan jadwal rutin. Gaya mengikuti arah Kalender Dinding
// (Task 14): baris agenda koran — kolom tanggal tabular di kiri (angka
// tanggal besar + bulan + jam mulai; aksen merah bila hari ini), isi
// di kanan, pemisah garis tipis antarbaris dari wadah daftar. Tanpa
// poster tampil baris tipografis murni (bukan blok warna); poster bila
// ada tampil sebagai gambar kecil proporsional di sisi kanan baris.

import Link from "next/link";
import { CATEGORY_STYLES, categoryLabel } from "../../lib/constants.ts";
import type { FeedItem } from "../../lib/feed.ts";
import {
  formatJamRange,
  formatTanggal,
  relativeDayLabel,
} from "../../lib/format.ts";

/** Nama bulan ringkas dari tanggal kalender, mis. "Okt". */
function monthShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "short",
  }).format(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)));
}

export function EventCard({
  item,
  todayIso,
}: {
  item: FeedItem;
  todayIso: string;
}) {
  const styles = CATEGORY_STYLES[item.category];
  const relLabel = relativeDayLabel(item.date, todayIso);
  const isToday = relLabel === "Hari ini";
  const dayNumber = String(Number(item.date.slice(8, 10)));

  return (
    <article className="flex gap-4 py-4">
      <div className="w-14 flex-none text-right">
        <div className="text-2xl font-extrabold leading-none tabular-nums text-neutral-900">
          {dayNumber}
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {monthShort(item.date)} {item.date.slice(0, 4)}
        </div>
        <div
          className={`mt-1 text-xs font-bold tabular-nums ${
            isToday ? "text-red-700" : "text-neutral-700"
          }`}
        >
          {item.startTime}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.08em]">
          <span className={`inline-flex items-center gap-1.5 ${styles.text}`}>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`}
            />
            {categoryLabel(item.category)}
          </span>
          {item.kind === "occurrence" ? (
            <span className="border border-neutral-400 px-1 py-px text-neutral-600">
              Rutin
            </span>
          ) : null}
          {item.isSpecialEdition ? (
            <span className="text-amber-700">Edisi Spesial</span>
          ) : null}
          {relLabel ? (
            isToday ? (
              <span className="bg-red-700 px-1.5 py-0.5 text-white">
                {relLabel}
              </span>
            ) : (
              <span className="text-neutral-500">{relLabel}</span>
            )
          ) : null}
          {item.isOngoing ? (
            <span className="text-red-700">Sedang Berlangsung</span>
          ) : null}
        </div>

        <h3 className="mt-1.5 text-base font-bold leading-snug text-neutral-900">
          <Link href={item.href} className="hover:underline">
            {item.title}
          </Link>
        </h3>

        <p className="mt-1 text-sm text-neutral-600">
          {formatTanggal(item.date)} ·{" "}
          {formatJamRange(item.startTime, item.endTime)}
        </p>
        {item.kind === "occurrence" && item.patternLabel ? (
          <p className="text-sm text-neutral-500">{item.patternLabel}</p>
        ) : null}

        <p className="mt-1 text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">{item.venueName}</span>
          <span className="text-neutral-500">
            {" "}
            — {item.district}, {item.city}
          </span>
        </p>

        {item.organizerName ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            {item.organizerLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.organizerLogoUrl}
                alt=""
                className="h-5 w-5 flex-none rounded-full object-cover"
              />
            ) : null}
            Penyelenggara: {item.organizerName}
          </p>
        ) : null}
        {item.isSpecialEdition && item.specialNote ? (
          <p className="mt-1 text-sm italic text-amber-800">
            {item.specialNote}
          </p>
        ) : null}
      </div>

      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.posterUrl}
          alt={`Poster ${item.title}`}
          className="h-28 w-20 flex-none self-start rounded-[2px] object-cover sm:h-32 sm:w-24"
          loading="lazy"
        />
      ) : null}
    </article>
  );
}
