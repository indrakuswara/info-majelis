// Direktori Majelis publik (plan Task 12; spec §9.3): hanya profil
// terbit, dapat difilter per kota/kabupaten. Jumlah acara akan datang
// dihitung dari event terbit mendatang + satu kemunculan berikutnya
// untuk setiap jadwal rutin terbit dan aktif milik majelis tersebut.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
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
    <article className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Logo atau foto ${majelis.name}`}
            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white"
          >
            {majelis.name.trim().charAt(0).toUpperCase() || "M"}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-snug text-neutral-950">
            <Link href={href} className="hover:underline">
              {majelis.name}
            </Link>
          </h2>
          {majelis.leader ? (
            <p className="mt-0.5 text-sm text-neutral-600">
              Pimpinan: {majelis.leader}
            </p>
          ) : null}
          <p className="mt-0.5 text-sm text-neutral-600">
            {majelis.baseDistrict ? `${majelis.baseDistrict}, ` : ""}
            {majelis.city}
          </p>
        </div>
      </div>
      {majelis.description ? (
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-neutral-700">
          {majelis.description}
        </p>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
          {upcomingCount} acara akan datang
        </span>
        <Link
          href={href}
          className="text-sm font-semibold text-emerald-800 underline underline-offset-4"
        >
          Lihat profil
        </Link>
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
      <div>
        <h1 className="text-2xl font-bold text-neutral-950">
          Direktori Majelis
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-neutral-600">
          Profil majelis yang sudah terbit beserta acara dan jadwal
          rutin yang mereka selenggarakan.
        </p>
      </div>

      <form
        method="get"
        action="/majelis"
        className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <label
          htmlFor="majelis-city"
          className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Kota/Kabupaten
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <select
            id="majelis-city"
            name="city"
            defaultValue={city}
            className="min-w-56 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          >
            <option value="">Semua kota/kabupaten</option>
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Terapkan
          </button>
          <Link
            href="/majelis"
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Atur Ulang
          </Link>
        </div>
        <p className="mt-3 text-sm text-neutral-600" role="status">
          Menampilkan {majelisList.length} majelis
        </p>
      </form>

      {majelisList.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
          <h2 className="text-lg font-semibold text-neutral-900">
            Belum ada majelis yang cocok
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
            Belum ada profil majelis terbit untuk filter kota ini.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
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
