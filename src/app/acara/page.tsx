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
  type FilterValues,
} from "../../components/public/FilterBar.tsx";
import { RailSlot } from "../../components/public/RailSlot.tsx";
import { CATEGORIES, REGIONS } from "../../lib/constants.ts";
import { ensureSchema } from "../../lib/db.ts";
import type { Category } from "../../lib/domain.ts";
import {
  getDistrictSuggestions,
  getUpcomingFeed,
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
  from?: string;
  to?: string;
  category?: string;
  city?: string;
  district?: string;
  q?: string;
}

/** Terima hanya "YYYY-MM-DD" yang merupakan tanggal kalender nyata. */
function parseDateParam(value: string | undefined): string {
  const s = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  const real =
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === (m ?? 1) - 1 &&
    dt.getUTCDate() === d;
  return real ? s : "";
}

function parseFilters(params: AcaraSearchParams): FilterValues {
  let from = parseDateParam(params.from);
  let to = parseDateParam(params.to);
  // Rentang terbalik ditukar agar tetap bermakna (bukan hasil kosong).
  if (from !== "" && to !== "" && from > to) [from, to] = [to, from];
  const category = CATEGORIES.some((c) => c.value === params.category)
    ? (params.category ?? "")
    : "";
  const city = REGIONS.includes(params.city ?? "") ? (params.city ?? "") : "";
  return {
    from,
    to,
    category,
    city,
    district: (params.district ?? "").trim(),
    q: (params.q ?? "").trim(),
  };
}

const hasFilter = (v: FilterValues): boolean =>
  v.from !== "" || v.to !== "" || v.category !== "" || v.city !== "" ||
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
      from: values.from === "" ? undefined : values.from,
      to: values.to === "" ? undefined : values.to,
      city: values.city === "" ? undefined : values.city,
      district: values.district === "" ? undefined : values.district,
      category: values.category === "" ? undefined : (values.category as Category),
      q: values.q === "" ? undefined : values.q,
    }),
    getDistrictSuggestions(values.city === "" ? undefined : values.city),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Semua Acara Akan Datang
        </h1>
        <p className="mt-1 text-sm text-muted">
          Event sekali jalan dan kemunculan jadwal rutin yang sudah terbit,
          terurut dari yang paling dekat.
        </p>
      </div>

      {/* Filter tinggal di rail desktop / bar mobile lewat RailSlot;
          posisi di sini adalah fallback aliran konten tanpa JS. */}
      <RailSlot>
        <FilterBar
          action="/acara"
          values={values}
          districts={districts}
          resultCount={feed.length}
        />
      </RailSlot>

      {feed.length === 0 ? (
        <section className="border border-dashed border-line bg-ivory px-5 py-10 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">
            Tidak ada acara yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            {hasFilter(values)
              ? "Belum ada acara terbit yang cocok dengan filter atau kata pencarian. Coba longgarkan filter, atau atur ulang untuk melihat semua acara."
              : "Belum ada acara terbit yang akan datang. Silakan kembali lagi nanti — jadwal baru ditambahkan secara berkala."}
          </p>
          {hasFilter(values) ? (
            <Link
              href="/acara"
              className="mt-4 inline-block rounded-[2px] bg-em px-5 py-2 text-xs font-bold uppercase tracking-wider text-paper hover:bg-em2"
            >
              Atur Ulang Filter
            </Link>
          ) : null}
        </section>
      ) : (
        <div className="grid border-l border-t border-line lg:grid-cols-2">
          {feed.map((item) => (
            <EventCard key={item.key} item={item} todayIso={today} />
          ))}
        </div>
      )}
    </div>
  );
}
