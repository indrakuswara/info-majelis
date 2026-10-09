// Beranda publik (plan Task 11; spec §9.1): hero + keterangan cakupan,
// bilah cari/filter (mengarah ke /acara), dan rimba acara gabungan
// (event + kemunculan rutin) terurut kronologis dalam horizon 60 hari,
// dikelompokkan Hari ini / Besok / Minggu ini / Nanti.

import Link from "next/link";
import { connection } from "next/server";
import { EventCard } from "../components/public/EventCard.tsx";
import { FilterBar } from "../components/public/FilterBar.tsx";
import { RailSlot } from "../components/public/RailSlot.tsx";
import { SITE_COVERAGE_NOTE } from "../lib/constants.ts";
import { ensureSchema } from "../lib/db.ts";
import { getUpcomingFeed, type FeedItem } from "../lib/feed.ts";
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
  const feed = await getUpcomingFeed(nowISO, {
    horizonDays: 60,
    capEvents: true,
  });

  const grouped = new Map<GroupKey, FeedItem[]>();
  for (const item of feed) {
    const key = groupOf(item.date, today);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  // Grup terdekat yang tidak kosong: item pertamanya tampil featured.
  const nearestKey = GROUPS.find(
    ({ key }) => (grouped.get(key)?.length ?? 0) > 0,
  )?.key;

  return (
    <div className="flex flex-col gap-8">
      <section className="border-b border-line pb-5">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Info Majelis
        </h1>
        <p className="mt-2 max-w-prose text-muted">
          Jadwal maulid, tabligh akbar, kajian, dan acara majelis untuk
          jamaah — tanpa perlu akun, langsung cari dan datang.
        </p>
        <p className="mt-3 border-l-2 border-gold pl-3 text-sm font-semibold text-ink">
          {SITE_COVERAGE_NOTE}
        </p>
      </section>

      {/* Filter tinggal di rail desktop / bar mobile lewat RailSlot;
          posisi di sini adalah fallback aliran konten tanpa JS. */}
      <RailSlot>
        <FilterBar
          action="/acara"
          values={{ from: "", to: "", category: "", city: "", q: "" }}
        />
      </RailSlot>

      {feed.length === 0 ? (
        <section className="border border-dashed border-line bg-ivory px-5 py-10 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">
            Belum ada jadwal terdekat
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            Belum ada acara terbit untuk 60 hari ke depan. Silakan kembali
            lagi nanti — jadwal baru ditambahkan secara berkala.
          </p>
        </section>
      ) : (
        GROUPS.map(({ key, label }) => {
          const items = grouped.get(key);
          if (!items || items.length === 0) return null;
          const featuredItem = key === nearestKey ? items[0] : undefined;
          const gridItems = featuredItem ? items.slice(1) : items;
          return (
            <section key={key} aria-label={label}>
              <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
                  {label}
                </h2>
                <span className="text-sm text-muted">
                  {items.length} acara
                </span>
              </div>
              {featuredItem ? (
                <div className="mt-5">
                  <EventCard item={featuredItem} todayIso={today} featured />
                </div>
              ) : null}
              {gridItems.length > 0 ? (
                <div className="mt-5 grid border-l border-t border-line lg:grid-cols-2">
                  {gridItems.map((item) => (
                    <EventCard key={item.key} item={item} todayIso={today} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/jadwal"
          className="border border-line bg-ivory p-5 hover:bg-paper"
        >
          <h2 className="font-display text-lg font-semibold text-ink">
            Jadwal Rutin
          </h2>
          <p className="mt-1 text-sm text-muted">
            Pengajian dan majelis yang berlangsung rutin setiap pekan atau
            bulan.
          </p>
        </Link>
        <Link
          href="/majelis"
          className="border border-line bg-ivory p-5 hover:bg-paper"
        >
          <h2 className="font-display text-lg font-semibold text-ink">
            Direktori Majelis
          </h2>
          <p className="mt-1 text-sm text-muted">
            Profil majelis beserta jadwal dan acara yang mereka
            selenggarakan.
          </p>
        </Link>
      </section>
    </div>
  );
}
