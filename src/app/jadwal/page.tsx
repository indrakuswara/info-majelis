// Daftar jadwal rutin publik (plan Task 12; spec §9.4): hanya rutin
// terbit dan aktif, dapat difilter lewat query string, lalu
// dikelompokkan Senin sampai Minggu. Hari untuk pola tanggal bulanan
// mengikuti hari kemunculan berikutnya karena tanggalnya berpindah
// hari dari bulan ke bulan.
//
// Presentasi Serambi (plan redesign Task 4): form filter adalah form
// GET lokal berkelas akar `pageform`, dibungkus RailSlot agar tampil
// di rail desktop / bar mobile; daftar pola berupa baris bersih
// berbatas token `line` dengan tanggal & judul serif Fraunces.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { RailSlot } from "../../components/public/RailSlot.tsx";
import { CATEGORIES, CATEGORY_STYLES, REGIONS, categoryLabel } from "../../lib/constants.ts";
import {
  ensureSchema,
  listPublishedMajelis,
  listPublishedRoutines,
  listRoutineExceptions,
} from "../../lib/db.ts";
import type { Occurrence, RoutineRecord } from "../../lib/domain.ts";
import { getDistrictSuggestions } from "../../lib/feed.ts";
import {
  formatJamRange,
  formatTanggal,
} from "../../lib/format.ts";
import {
  WEEKDAY_NAMES,
  computeOccurrences,
  describePattern,
} from "../../lib/recurrence.ts";
import { nowWibISO } from "../../lib/utils.ts";

export const instant = false;

export const metadata: Metadata = {
  title: "Jadwal Rutin",
  description:
    "Daftar jadwal rutin majelis yang terbit dan aktif, dikelompokkan berdasarkan hari.",
};

interface JadwalSearchParams {
  city?: string;
  district?: string;
  category?: string;
  weekday?: string;
}

interface RoutineListItem {
  routine: RoutineRecord;
  next: Occurrence | null;
  organizerName: string | null;
  groupWeekday: number | null;
}

const GROUP_ORDER = [1, 2, 3, 4, 5, 6, 0];
const inputClass =
  "w-full rounded-[2px] border border-line bg-paper px-2.5 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-em focus:outline-none";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-[0.12em] text-muted";

function weekdayOfDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

function groupWeekdayOf(
  routine: RoutineRecord,
  next: Occurrence | null,
): number | null {
  if (routine.pattern.kind === "weekly") return routine.pattern.weekday;
  if (routine.pattern.kind === "monthly-weekday") {
    return routine.pattern.weekday;
  }
  return next ? weekdayOfDate(next.date) : null;
}

function RoutineCard({ item }: { item: RoutineListItem }) {
  const { routine, next } = item;
  const styles = CATEGORY_STYLES[routine.category];
  const href = `/acara/${routine.slug}`;

  return (
    <article className="flex gap-4 py-4">
      <div className="w-14 flex-none text-right">
        {next ? (
          <>
            <div className="font-display text-[28px] font-semibold leading-none tabular-nums text-em">
              {String(Number(next.date.slice(8, 10)))}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {formatTanggal(next.date).split(" ").slice(2).join(" ")}
            </div>
            <div className="mt-1 text-xs font-bold tabular-nums text-ink">
              {next.startTime}
            </div>
          </>
        ) : (
          <div className="font-display text-[28px] font-semibold leading-none text-muted">
            –
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.08em]">
          <span className={`inline-flex items-center gap-1.5 ${styles.text}`}>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 flex-none rounded-full ${styles.dot}`}
            />
            {categoryLabel(routine.category)}
          </span>
          <span className="rounded-[2px] border border-line px-1.5 py-px text-muted">
            Rutin
          </span>
          {next?.exceptionKind === "edisi-spesial" ? (
            <span className="rounded-[2px] border border-gold bg-[#f7ecd2] px-1.5 py-px text-[#8a6410]">
              Berikutnya Edisi Spesial
            </span>
          ) : null}
        </div>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink">
          <Link href={href} className="hover:underline">
            {routine.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm font-medium text-ink">
          {describePattern(routine.pattern, {
            startTime: routine.startTime,
          })}{" "}
          · {formatJamRange(routine.startTime, routine.endTime)}
        </p>
        {next ? (
          <p className="mt-1 text-sm text-muted">
            Berikutnya: {formatTanggal(next.date)},{" "}
            {formatJamRange(next.startTime, routine.endTime)}
          </p>
        ) : (
          <p className="mt-1 text-sm font-medium text-[#8a6410]">
            Belum ada jadwal berikutnya yang terkonfirmasi
          </p>
        )}
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-ink">
            {next?.venueName ?? routine.venueName}
          </span>{" "}
          — {routine.district}, {routine.city}
        </p>
        {item.organizerName ? (
          <p className="mt-1 text-sm text-muted">
            Penyelenggara: {item.organizerName}
          </p>
        ) : null}
        <Link
          href={href}
          className="mt-2 inline-block text-sm font-semibold text-em underline underline-offset-4 hover:text-em2"
        >
          Lihat detail rutin
        </Link>
      </div>

      {routine.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={routine.posterUrl}
          alt={`Poster ${routine.title}`}
          className="h-28 w-20 flex-none self-start rounded-[2px] border border-line object-cover sm:h-32 sm:w-24"
          loading="lazy"
        />
      ) : null}
    </article>
  );
}

export default async function JadwalPage({
  searchParams,
}: {
  searchParams: Promise<JadwalSearchParams>;
}) {
  await connection();
  await ensureSchema();
  const params = await searchParams;
  const city = REGIONS.includes(params.city ?? "") ? (params.city ?? "") : "";
  const district = (params.district ?? "").trim();
  const category = CATEGORIES.some((c) => c.value === params.category)
    ? (params.category ?? "")
    : "";
  const weekday =
    params.weekday !== undefined && /^[0-6]$/.test(params.weekday)
      ? Number(params.weekday)
      : undefined;

  const [routines, publishedMajelis, districts] = await Promise.all([
    listPublishedRoutines({
      city: city || undefined,
      district: district || undefined,
      category: category || undefined,
      weekday,
    }),
    listPublishedMajelis({}),
    getDistrictSuggestions(city || undefined),
  ]);
  const majelisById = new Map(publishedMajelis.map((m) => [m.id, m]));

  const items: RoutineListItem[] = await Promise.all(
    routines.map(async (routine) => {
      const exceptions = await listRoutineExceptions(routine.id);
      const next =
        computeOccurrences(routine, exceptions, nowWibISO(), 1)[0] ?? null;
      const organizerName = routine.organizerMajelisId
        ? (majelisById.get(routine.organizerMajelisId)?.name ?? null)
        : routine.organizerNameManual;
      return {
        routine,
        next,
        organizerName,
        groupWeekday: groupWeekdayOf(routine, next),
      };
    }),
  );

  const grouped = new Map<number | null, RoutineListItem[]>();
  for (const item of items) {
    const list = grouped.get(item.groupWeekday) ?? [];
    list.push(item);
    grouped.set(item.groupWeekday, list);
  }
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        a.routine.startTime.localeCompare(b.routine.startTime) ||
        a.routine.title.localeCompare(b.routine.title),
    );
  }

  const hasFilter =
    city !== "" || district !== "" || category !== "" || weekday !== undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="border-b border-line pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          Jadwal Berkala
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
          Jadwal Rutin
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Semua jadwal rutin yang terbit dan aktif, dikelompokkan
          berdasarkan hari kemunculannya.
        </p>
      </div>

      {/* Filter tinggal di rail desktop / bar mobile lewat RailSlot;
          posisi di sini adalah fallback aliran konten tanpa JS. */}
      <RailSlot>
      <form
        method="get"
        action="/jadwal"
        className="pageform flex flex-col gap-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="jadwal-city" className={labelClass}>
              Kota/Kabupaten
            </label>
            <select id="jadwal-city" name="city" defaultValue={city} className={inputClass}>
              <option value="">Semua kota/kabupaten</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="jadwal-district" className={labelClass}>
              Kecamatan
            </label>
            <input
              id="jadwal-district"
              name="district"
              defaultValue={district}
              list="jadwal-districts"
              placeholder="Semua kecamatan"
              className={inputClass}
            />
            <datalist id="jadwal-districts">
              {districts.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="jadwal-category" className={labelClass}>
              Kategori
            </label>
            <select id="jadwal-category" name="category" defaultValue={category} className={inputClass}>
              <option value="">Semua kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="jadwal-weekday" className={labelClass}>
              Hari
            </label>
            <select
              id="jadwal-weekday"
              name="weekday"
              defaultValue={weekday === undefined ? "" : String(weekday)}
              className={inputClass}
            >
              <option value="">Semua hari</option>
              {GROUP_ORDER.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_NAMES[day]}
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
            Terapkan Filter
          </button>
          <a
            href="/jadwal"
            className="rounded-[2px] border border-em px-5 py-2 text-xs font-bold uppercase tracking-wider text-em hover:bg-ivory"
          >
            Atur Ulang
          </a>
          <span className="pageform-count text-sm text-muted" role="status">
            Menampilkan {items.length} jadwal rutin
          </span>
        </div>
      </form>
      </RailSlot>

      {items.length === 0 ? (
        <section className="border border-dashed border-line px-5 py-10 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">
            Tidak ada jadwal rutin yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            {hasFilter
              ? "Belum ada jadwal rutin terbit dan aktif yang cocok dengan filter di atas."
              : "Belum ada jadwal rutin terbit dan aktif saat ini."}
          </p>
        </section>
      ) : (
        <>
          {GROUP_ORDER.map((day) => {
            const group = grouped.get(day);
            if (!group || group.length === 0) return null;
            return (
              <section key={day} aria-label={`Jadwal hari ${WEEKDAY_NAMES[day]}`}>
                <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
                  <h2 className="font-display text-lg font-semibold text-em">
                    {WEEKDAY_NAMES[day]}
                  </h2>
                  <span className="text-sm text-muted">
                    {group.length} jadwal
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {group.map((item) => (
                    <RoutineCard key={item.routine.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
          {grouped.get(null)?.length ? (
            <section aria-label="Jadwal tanpa hari tetap">
              <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
                <h2 className="font-display text-lg font-semibold text-em">
                  Belum Ada Hari Kemunculan Berikutnya
                </h2>
                <span className="text-sm text-muted">
                  {grouped.get(null)?.length} jadwal
                </span>
              </div>
              <div className="divide-y divide-line">
                {grouped.get(null)?.map((item) => (
                  <RoutineCard key={item.routine.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
