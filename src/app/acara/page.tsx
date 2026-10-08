// Daftar semua acara akan datang (plan Task 11; spec §9.1/§9.8):
// event sekali jalan + kemunculan jadwal rutin, difilter & dicari
// lewat query string (form GET FilterBar — tanpa JavaScript tetap
// berfungsi). Hanya konten terbit dari fungsi repository publik.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EventCard } from "../../components/public/EventCard.tsx";
import {
  FilterBar,
  RANGE_OPTIONS,
  type FilterValues,
} from "../../components/public/FilterBar.tsx";
import { CATEGORIES, REGIONS } from "../../lib/constants.ts";
import { ensureSchema } from "../../lib/db.ts";
import type { Category } from "../../lib/domain.ts";
import {
  getDistrictSuggestions,
  getUpcomingFeed,
  type UpcomingRange,
} from "../../lib/feed.ts";
import { wibTodayISODate } from "../../lib/format.ts";
import { nowWibISO } from "../../lib/utils.ts";

export const instant = false;

export const metadata: Metadata = {
  title: "Daftar Acara",
  description:
    "Semua acara majelis yang akan datang — maulid, tabligh akbar, kajian, dan lainnya — dengan filter kota, kecamatan, dan kategori.",
};

interface AcaraSearchParams {
  range?: string;
  category?: string;
  city?: string;
  district?: string;
  q?: string;
}

function parseFilters(params: AcaraSearchParams): FilterValues {
  const range = RANGE_OPTIONS.some((o) => o.value === params.range)
    ? (params.range as UpcomingRange)
    : "all";
  const category = CATEGORIES.some((c) => c.value === params.category)
    ? (params.category ?? "")
    : "";
  const city = REGIONS.includes(params.city ?? "") ? (params.city ?? "") : "";
  return {
    range,
    category,
    city,
    district: (params.district ?? "").trim(),
    q: (params.q ?? "").trim(),
  };
}

const hasFilter = (v: FilterValues): boolean =>
  v.range !== "all" || v.category !== "" || v.city !== "" ||
  v.district !== "" || v.q !== "";

export default async function AcaraPage({
  searchParams,
}: {
  searchParams: Promise<AcaraSearchParams>;
}) {
  await connection();
  await ensureSchema();
  const values = parseFilters(await searchParams);

  const nowISO = nowWibISO();
  const today = wibTodayISODate();
  const [feed, districts] = await Promise.all([
    getUpcomingFeed(nowISO, {
      range: values.range,
      city: values.city === "" ? undefined : values.city,
      district: values.district === "" ? undefined : values.district,
      category: values.category === "" ? undefined : (values.category as Category),
      q: values.q === "" ? undefined : values.q,
    }),
    getDistrictSuggestions(values.city === "" ? undefined : values.city),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b-2 border-neutral-900 pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
          Semua Acara Akan Datang
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Event sekali jalan dan kemunculan jadwal rutin yang sudah terbit,
          terurut dari yang paling dekat.
        </p>
      </div>

      <FilterBar
        action="/acara"
        values={values}
        districts={districts}
        resultCount={feed.length}
      />

      {feed.length === 0 ? (
        <section className="border border-dashed border-neutral-400 px-5 py-10 text-center">
          <h2 className="text-lg font-bold text-neutral-900">
            Tidak ada acara yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
            {hasFilter(values)
              ? "Belum ada acara terbit yang cocok dengan filter atau kata pencarian di atas. Coba longgarkan filter, atau atur ulang untuk melihat semua acara."
              : "Belum ada acara terbit yang akan datang. Silakan kembali lagi nanti — jadwal baru ditambahkan secara berkala."}
          </p>
          {hasFilter(values) ? (
            <Link
              href="/acara"
              className="mt-4 inline-block rounded-none bg-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-700"
            >
              Atur Ulang Filter
            </Link>
          ) : null}
        </section>
      ) : (
        <div className="divide-y divide-[#e3e0d5] border-b border-[#e3e0d5]">
          {feed.map((item) => (
            <EventCard key={item.key} item={item} todayIso={today} />
          ))}
        </div>
      )}
    </div>
  );
}
