// Kartu jadwal publik (plan Task 11; spec §9.2 & §11/§12): dipakai di
// beranda & daftar acara untuk event sekali jalan maupun kemunculan
// jadwal rutin. Poster bila ada; tanpa poster ⇒ blok fallback berwarna
// per kategori dengan tanggal besar & nama majelis/logo bila ada.

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

/** Nama hari dari tanggal kalender, mis. "Kamis". */
function weekdayName(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
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
  const dayNumber = String(Number(item.date.slice(8, 10)));

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.posterUrl}
          alt={`Poster ${item.title}`}
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className={`flex aspect-[4/3] flex-col justify-between p-5 text-white ${styles.fallback}`}
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium uppercase tracking-wide opacity-90">
              {weekdayName(item.date)}
            </span>
            {item.organizerLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.organizerLogoUrl}
                alt=""
                className="h-10 w-10 rounded-full bg-white/90 object-cover"
              />
            ) : null}
          </div>
          <div>
            <div className="text-6xl font-bold leading-none">{dayNumber}</div>
            <div className="mt-1 text-lg font-medium">
              {monthShort(item.date)} {item.date.slice(0, 4)}
            </div>
            {item.organizerName ? (
              <div className="mt-3 line-clamp-1 text-sm opacity-90">
                {item.organizerName}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles.chip}`}
          >
            {categoryLabel(item.category)}
          </span>
          {item.kind === "occurrence" ? (
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-white">
              Rutin
            </span>
          ) : null}
          {item.isSpecialEdition ? (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">
              Edisi Spesial
            </span>
          ) : null}
          {relLabel ? (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
              {relLabel}
            </span>
          ) : null}
          {item.isOngoing ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
              Sedang Berlangsung
            </span>
          ) : null}
        </div>

        <h3 className="text-base font-semibold leading-snug text-neutral-900">
          <Link href={item.href} className="hover:underline">
            {item.title}
          </Link>
        </h3>

        <p className="text-sm text-neutral-700">
          {formatTanggal(item.date)} · {formatJamRange(item.startTime, item.endTime)}
        </p>
        {item.kind === "occurrence" && item.patternLabel ? (
          <p className="text-sm text-neutral-500">{item.patternLabel}</p>
        ) : null}

        <p className="text-sm text-neutral-700">
          {item.venueName}
          <span className="text-neutral-500">
            {" "}
            — {item.district}, {item.city}
          </span>
        </p>

        {item.organizerName ? (
          <p className="text-sm text-neutral-500">
            Penyelenggara: {item.organizerName}
          </p>
        ) : null}
        {item.isSpecialEdition && item.specialNote ? (
          <p className="text-sm italic text-amber-800">{item.specialNote}</p>
        ) : null}
      </div>
    </article>
  );
}
