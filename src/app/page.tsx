// Beranda publik (plan Task 11; spec §9.1): hero + keterangan cakupan,
// bilah cari/filter (mengarah ke /acara), dan rimba acara gabungan
// (event + kemunculan rutin) terurut kronologis dalam horizon 60 hari,
// dikelompokkan Hari ini / Besok / Minggu ini / Nanti.

import Link from "next/link";
import { connection } from "next/server";
import { EventCard } from "../components/public/EventCard.tsx";
import { FilterBar } from "../components/public/FilterBar.tsx";
import { SITE_COVERAGE_NOTE } from "../lib/constants.ts";
import { ensureSchema } from "../lib/db.ts";
import { getDistrictSuggestions, getUpcomingFeed, type FeedItem } from "../lib/feed.ts";
import { addDaysISODate, wibTodayISODate } from "../lib/format.ts";
import { nowWibISO } from "../lib/utils.ts";

export const instant = false;

type GroupKey = "today" | "tomorrow" | "week" | "later";

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "tomorrow", label: "Besok" },
  { key: "week", label: "Minggu Ini" },
  { key: "later", label: "Nanti" },
];

function groupOf(date: string, today: string): GroupKey {
  // Tanggal lampau di sini hanya untuk acara yang sedang berlangsung
  // (mulai kemarin, belum selesai) — tampilkan di "Hari Ini".
  if (date <= today) return "today";
  if (date === addDaysISODate(today, 1)) return "tomorrow";
  if (date <= addDaysISODate(today, 6)) return "week";
  return "later";
}

export default async function HomePage() {
  await connection();
  await ensureSchema();

  const nowISO = nowWibISO();
  const today = wibTodayISODate();
  const [feed, districts] = await Promise.all([
    getUpcomingFeed(nowISO, { horizonDays: 60, capEvents: true }),
    getDistrictSuggestions(),
  ]);

  const grouped = new Map<GroupKey, FeedItem[]>();
  for (const item of feed) {
    const key = groupOf(item.date, today);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl bg-emerald-800 px-5 py-8 text-white sm:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Info Majelis</h1>
        <p className="mt-2 max-w-prose text-emerald-50">
          Jadwal maulid, tabligh akbar, kajian, dan acara majelis untuk
          jamaah — tanpa perlu akun, langsung cari dan datang.
        </p>
        <p className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
          {SITE_COVERAGE_NOTE}
        </p>
      </section>

      <FilterBar
        action="/acara"
        values={{ range: "all", category: "", city: "", district: "", q: "" }}
        districts={districts}
      />

      {feed.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
          <h2 className="text-lg font-semibold text-neutral-900">
            Belum ada jadwal terdekat
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
            Belum ada acara terbit untuk 60 hari ke depan. Silakan kembali
            lagi nanti — jadwal baru ditambahkan secara berkala.
          </p>
        </section>
      ) : (
        GROUPS.map(({ key, label }) => {
          const items = grouped.get(key);
          if (!items || items.length === 0) return null;
          return (
            <section key={key} aria-label={label}>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-neutral-900">{label}</h2>
                <span className="text-sm text-neutral-500">
                  {items.length} acara
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <EventCard key={item.key} item={item} todayIso={today} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/jadwal"
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-600"
        >
          <h2 className="font-semibold text-neutral-900">Jadwal Rutin</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Pengajian dan majelis yang berlangsung rutin setiap pekan atau
            bulan.
          </p>
        </Link>
        <Link
          href="/majelis"
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-600"
        >
          <h2 className="font-semibold text-neutral-900">Direktori Majelis</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Profil majelis beserta jadwal dan acara yang mereka
            selenggarakan.
          </p>
        </Link>
      </section>
    </div>
  );
}
