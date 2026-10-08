// Daftar jadwal rutin publik (plan Task 12; spec §9.4): hanya rutin
// terbit dan aktif, dapat difilter lewat query string, lalu
// dikelompokkan Senin sampai Minggu. Hari untuk pola tanggal bulanan
// mengikuti hari kemunculan berikutnya karena tanggalnya berpindah
// hari dari bulan ke bulan.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
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
  "w-full rounded-none border-0 border-b border-neutral-400 bg-transparent px-0 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500";

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
            <div className="text-2xl font-extrabold leading-none tabular-nums text-neutral-900">
              {String(Number(next.date.slice(8, 10)))}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {formatTanggal(next.date).split(" ").slice(2).join(" ")}
            </div>
            <div className="mt-1 text-xs font-bold tabular-nums text-neutral-700">
              {next.startTime}
            </div>
          </>
        ) : (
          <div className="text-2xl font-extrabold leading-none text-neutral-400">
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
          <span className="border border-neutral-400 px-1 py-px text-neutral-600">
            Rutin
          </span>
          {next?.exceptionKind === "edisi-spesial" ? (
            <span className="text-amber-700">Berikutnya Edisi Spesial</span>
          ) : null}
        </div>
        <h3 className="mt-1.5 text-base font-bold leading-snug text-neutral-900">
          <Link href={href} className="hover:underline">
            {routine.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm font-medium text-neutral-800">
          {describePattern(routine.pattern, {
            startTime: routine.startTime,
          })}{" "}
          · {formatJamRange(routine.startTime, routine.endTime)}
        </p>
        {next ? (
          <p className="mt-1 text-sm text-neutral-600">
            Berikutnya: {formatTanggal(next.date)},{" "}
            {formatJamRange(next.startTime, routine.endTime)}
          </p>
        ) : (
          <p className="mt-1 text-sm font-medium text-amber-800">
            Belum ada jadwal berikutnya yang terkonfirmasi
          </p>
        )}
        <p className="mt-1 text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">
            {next?.venueName ?? routine.venueName}
          </span>{" "}
          — {routine.district}, {routine.city}
        </p>
        {item.organizerName ? (
          <p className="mt-1 text-sm text-neutral-500">
            Penyelenggara: {item.organizerName}
          </p>
        ) : null}
        <Link
          href={href}
          className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4"
        >
          Lihat detail rutin
        </Link>
      </div>

      {routine.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={routine.posterUrl}
          alt={`Poster ${routine.title}`}
          className="h-28 w-20 flex-none self-start rounded-[2px] object-cover sm:h-32 sm:w-24"
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
      <div className="border-b-2 border-neutral-900 pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950">
          Jadwal Rutin
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-neutral-600">
          Semua jadwal rutin yang terbit dan aktif, dikelompokkan
          berdasarkan hari kemunculannya.
        </p>
      </div>

      <form
        method="get"
        action="/jadwal"
        className="border-b border-[#e3e0d5] border-t-[3px] border-t-neutral-900 py-4"
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-none bg-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-700"
          >
            Terapkan Filter
          </button>
          <a
            href="/jadwal"
            className="rounded-none border border-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-neutral-900 hover:bg-neutral-100"
          >
            Atur Ulang
          </a>
          <span className="text-sm text-neutral-600" role="status">
            Menampilkan {items.length} jadwal rutin
          </span>
        </div>
      </form>

      {items.length === 0 ? (
        <section className="border border-dashed border-neutral-400 px-5 py-10 text-center">
          <h2 className="text-lg font-bold text-neutral-900">
            Tidak ada jadwal rutin yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
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
                <div className="flex items-baseline justify-between gap-2 border-b-2 border-neutral-900 pb-1.5">
                  <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-neutral-950">
                    {WEEKDAY_NAMES[day]}
                  </h2>
                  <span className="text-sm text-neutral-500">
                    {group.length} jadwal
                  </span>
                </div>
                <div className="divide-y divide-[#e3e0d5]">
                  {group.map((item) => (
                    <RoutineCard key={item.routine.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
          {grouped.get(null)?.length ? (
            <section aria-label="Jadwal tanpa hari tetap">
              <div className="flex items-baseline justify-between gap-2 border-b-2 border-neutral-900 pb-1.5">
                <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-neutral-950">
                  Belum Ada Hari Kemunculan Berikutnya
                </h2>
                <span className="text-sm text-neutral-500">
                  {grouped.get(null)?.length} jadwal
                </span>
              </div>
              <div className="divide-y divide-[#e3e0d5]">
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
