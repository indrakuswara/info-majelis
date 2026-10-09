// Direktori Majelis publik (plan Task 12; spec §9.3): hanya profil
// terbit, dapat difilter per kota/kabupaten. Jumlah acara akan datang
// dihitung dari event terbit mendatang + satu kemunculan berikutnya
// untuk setiap jadwal rutin terbit dan aktif milik majelis tersebut.
//
// Presentasi Serambi (plan redesign Task 4): form filter kota adalah
// form GET lokal berkelas akar `pageform`, dibungkus RailSlot agar
// tampil di rail desktop / bar mobile; direktori menjadi grid kartu
// profil 2 kolom di desktop.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { RailSlot } from "../../components/public/RailSlot.tsx";
import { REGIONS } from "../../lib/constants.ts";
import {
  ensureSchema,
  listPublishedMajelis,
  listPublishedRoutines,
  listPublishedUpcoming,
  listRoutineExceptions,
} from "../../lib/db.ts";
import type { MajelisRecord } from "../../lib/domain.ts";
import { computeOccurrences } from "../../lib/recurrence.ts";
import { nowWibISO } from "../../lib/utils.ts";

export const instant = false;

export const metadata: Metadata = {
  title: "Direktori Majelis",
  description: "Direktori profil majelis yang terbit beserta acara dan jadwal rutinnya.",
};

function MajelisCard({
  majelis,
  upcomingCount,
}: {
  majelis: MajelisRecord;
  upcomingCount: number;
}) {
  const imageUrl = majelis.logoUrl ?? majelis.photoUrl;
  const href = `/majelis/${majelis.slug}`;
  return (
    <article className="flex gap-4 border border-line bg-ivory p-5">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`Logo atau foto ${majelis.name}`}
          className="h-16 w-16 shrink-0 rounded-[2px] border border-line object-cover"
          loading="lazy"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[2px] bg-em font-display text-2xl font-semibold text-paper"
        >
          {majelis.name.trim().charAt(0).toUpperCase() || "M"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl font-semibold leading-snug text-ink">
          <Link href={href} className="hover:underline">
            {majelis.name}
          </Link>
        </h2>
        {majelis.leader ? (
          <p className="mt-0.5 text-sm text-muted">
            Pimpinan: {majelis.leader}
          </p>
        ) : null}
        <p className="mt-0.5 text-sm text-muted">
          {majelis.baseDistrict ? `${majelis.baseDistrict}, ` : ""}
          {majelis.city}
        </p>
        {majelis.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink">
            {majelis.description}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            {upcomingCount} acara akan datang
          </span>
          <Link
            href={href}
            className="text-sm font-semibold text-em underline underline-offset-4 hover:text-em2"
          >
            Lihat profil
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function MajelisDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  await connection();
  await ensureSchema();
  const { city: rawCity } = await searchParams;
  const city = REGIONS.includes(rawCity ?? "") ? (rawCity ?? "") : "";
  const nowISO = nowWibISO();

  const [majelisList, upcomingEvents, routines] = await Promise.all([
    listPublishedMajelis({ city: city || undefined }),
    listPublishedUpcoming({ nowISO }),
    listPublishedRoutines({}),
  ]);

  const upcomingCounts = new Map<string, number>();
  for (const event of upcomingEvents) {
    if (!event.organizerMajelisId) continue;
    upcomingCounts.set(
      event.organizerMajelisId,
      (upcomingCounts.get(event.organizerMajelisId) ?? 0) + 1,
    );
  }
  await Promise.all(
    routines.map(async (routine) => {
      if (!routine.organizerMajelisId) return;
      const exceptions = await listRoutineExceptions(routine.id);
      const next = computeOccurrences(routine, exceptions, nowISO, 1)[0];
      if (!next) return;
      upcomingCounts.set(
        routine.organizerMajelisId,
        (upcomingCounts.get(routine.organizerMajelisId) ?? 0) + 1,
      );
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-line pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          Direktori
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
          Direktori Majelis
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Profil majelis yang sudah terbit beserta acara dan jadwal
          rutin yang mereka selenggarakan.
        </p>
      </div>

      {/* Filter tinggal di rail desktop / bar mobile lewat RailSlot;
          posisi di sini adalah fallback aliran konten tanpa JS. */}
      <RailSlot>
      <form
        method="get"
        action="/majelis"
        className="pageform flex flex-col gap-4"
      >
        <div className="grid gap-3">
          <div>
            <label
              htmlFor="majelis-city"
              className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted"
            >
              Kota/Kabupaten
            </label>
            <select
              id="majelis-city"
              name="city"
              defaultValue={city}
              className="w-full rounded-[2px] border border-line bg-paper px-2.5 py-2 text-sm text-ink focus:border-em focus:outline-none"
            >
              <option value="">Semua kota/kabupaten</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="pageform-actions flex flex-wrap items-stretch gap-2">
          <button
            type="submit"
            className="flex-1 whitespace-nowrap rounded-[2px] bg-em px-5 py-2 text-center text-xs font-bold uppercase tracking-wider text-paper hover:bg-em2"
          >
            Terapkan
          </button>
          <Link
            href="/majelis"
            className="flex flex-1 items-center justify-center whitespace-nowrap rounded-[2px] border border-em px-5 py-2 text-center text-xs font-bold uppercase tracking-wider text-em hover:bg-ivory"
          >
            Reset
          </Link>
          <span className="pageform-count self-center text-sm text-muted" role="status">
            Menampilkan {majelisList.length} majelis
          </span>
        </div>
      </form>
      </RailSlot>

      {majelisList.length === 0 ? (
        <section className="border border-dashed border-line px-5 py-10 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">
            Belum ada majelis yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
            Belum ada profil majelis terbit untuk filter kota ini.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {majelisList.map((majelis) => (
            <MajelisCard
              key={majelis.id}
              majelis={majelis}
              upcomingCount={upcomingCounts.get(majelis.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
