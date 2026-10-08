// Profil Majelis publik (plan Task 12; spec §9.3): hanya profil
// terbit. Isinya menggabungkan data profil, acara sekali jalan
// mendatang milik majelis ini, kemunculan berikutnya dari jadwal
// rutinnya, dan daftar jadwal rutin aktifnya. Event/rutin draft atau
// nonaktif tidak pernah diambil dari repository publik.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventCard } from "../../../components/public/EventCard.tsx";
import {
  ensureSchema,
  getPublishedMajelisBySlug,
  listPublishedRoutines,
  listPublishedUpcoming,
  listRoutineExceptions,
  parseISODateTime,
} from "../../../lib/db.ts";
import type { Occurrence, RoutineRecord } from "../../../lib/domain.ts";
import {
  eventToFeedItem,
  occurrenceToFeedItem,
  type FeedItem,
} from "../../../lib/feed.ts";
import {
  formatJamRange,
  formatTanggal,
  wibTodayISODate,
} from "../../../lib/format.ts";
import {
  computeOccurrences,
  describePattern,
} from "../../../lib/recurrence.ts";
import { nowWibISO } from "../../../lib/utils.ts";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  await connection();
  await ensureSchema();
  const { slug } = await params;
  const majelis = await getPublishedMajelisBySlug(slug);
  if (!majelis) return { title: "Majelis tidak ditemukan" };
  return {
    title: majelis.name,
    description:
      majelis.description ??
      `Profil ${majelis.name} beserta acara dan jadwal rutinnya di Info Majelis.`,
  };
}

interface RoutineWithNext {
  routine: RoutineRecord;
  next: Occurrence | null;
}

function SocialLink({ label, href }: { label: string; href: string | null }) {
  if (!href) return null;
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-emerald-800 underline underline-offset-4"
      >
        {label}
      </a>
    </li>
  );
}

export default async function MajelisProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  await ensureSchema();
  const { slug } = await params;
  const majelis = await getPublishedMajelisBySlug(slug);
  if (!majelis) notFound();

  const nowISO = nowWibISO();
  const nowTs = parseISODateTime(nowISO);
  const today = wibTodayISODate();
  const majelisById = new Map([[majelis.id, majelis]]);

  const [allUpcomingEvents, allRoutines] = await Promise.all([
    listPublishedUpcoming({ nowISO }),
    listPublishedRoutines({}),
  ]);
  const ownEvents = allUpcomingEvents.filter(
    (event) => event.organizerMajelisId === majelis.id,
  );
  const ownRoutines = allRoutines.filter(
    (routine) => routine.organizerMajelisId === majelis.id,
  );

  const routinesWithNext: RoutineWithNext[] = await Promise.all(
    ownRoutines.map(async (routine) => {
      const exceptions = await listRoutineExceptions(routine.id);
      return {
        routine,
        next: computeOccurrences(routine, exceptions, nowISO, 1)[0] ?? null,
      };
    }),
  );

  const upcomingItems: FeedItem[] = [
    ...ownEvents.map((event) => eventToFeedItem(event, majelisById, nowTs)),
    ...routinesWithNext.flatMap(({ routine, next }) =>
      next ? [occurrenceToFeedItem(routine, next, majelisById)] : [],
    ),
  ].sort((a, b) => a.sortTs - b.sortTs || a.title.localeCompare(b.title));

  const headerImage = majelis.photoUrl ?? majelis.logoUrl;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/majelis"
        className="text-sm font-medium text-emerald-800 underline underline-offset-4"
      >
        ← Direktori majelis
      </Link>

      <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headerImage}
            alt={`Foto atau logo ${majelis.name}`}
            className="max-h-80 w-full object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            {majelis.logoUrl && majelis.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={majelis.logoUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl object-cover"
              />
            ) : null}
            <div>
              <h1 className="text-3xl font-bold leading-tight text-neutral-950">
                {majelis.name}
              </h1>
              <p className="mt-1 text-neutral-600">
                {majelis.baseDistrict ? `${majelis.baseDistrict}, ` : ""}
                {majelis.city}
              </p>
              {majelis.leader ? (
                <p className="mt-1 text-sm text-neutral-600">
                  Pimpinan: {majelis.leader}
                </p>
              ) : null}
            </div>
          </div>

          {majelis.description ? (
            <p className="whitespace-pre-line leading-relaxed text-neutral-700">
              {majelis.description}
            </p>
          ) : null}

          <dl className="grid gap-4 sm:grid-cols-2">
            {majelis.baseAddress ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Alamat Markas
                </dt>
                <dd className="mt-1 text-neutral-900">
                  {majelis.baseAddress}
                  {majelis.baseDistrict || majelis.city ? (
                    <span className="block text-sm text-neutral-600">
                      {majelis.baseDistrict ? `${majelis.baseDistrict}, ` : ""}
                      {majelis.city}
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {majelis.contact ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Kontak
                </dt>
                <dd className="mt-1 whitespace-pre-line text-neutral-900">
                  {majelis.contact}
                </dd>
                <dd className="mt-1 text-xs text-neutral-500">
                  Kontak ini ditampilkan publik sesuai data majelis.
                </dd>
              </div>
            ) : null}
          </dl>

          {majelis.baseMapsUrl ? (
            <div>
              <a
                href={majelis.baseMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Rute ke Markas
              </a>
            </div>
          ) : null}

          {majelis.instagramUrl ||
          majelis.youtubeUrl ||
          majelis.tiktokUrl ||
          majelis.websiteUrl ? (
            <section>
              <h2 className="text-lg font-semibold text-neutral-950">
                Media Sosial & Situs
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                <SocialLink label="Instagram" href={majelis.instagramUrl} />
                <SocialLink label="YouTube" href={majelis.youtubeUrl} />
                <SocialLink label="TikTok" href={majelis.tiktokUrl} />
                <SocialLink label="Situs web" href={majelis.websiteUrl} />
              </ul>
            </section>
          ) : null}

          <p className="border-t border-neutral-200 pt-4 text-sm text-neutral-500">
            Terakhir diperbarui: {formatTanggal(majelis.updatedAt)}
          </p>
        </div>
      </article>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-neutral-950">
            Acara Akan Datang
          </h2>
          <span className="text-sm text-neutral-500">
            {upcomingItems.length} acara
          </span>
        </div>
        {upcomingItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-8 text-center text-sm text-neutral-600">
            Belum ada acara mendatang dari majelis ini.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingItems.map((item) => (
              <EventCard key={item.key} item={item} todayIso={today} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-neutral-950">
          Jadwal Rutin Majelis Ini
        </h2>
        {routinesWithNext.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-8 text-center text-sm text-neutral-600">
            Majelis ini belum memiliki jadwal rutin terbit yang aktif.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {routinesWithNext.map(({ routine, next }) => (
              <article
                key={routine.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold leading-snug text-neutral-950">
                  <Link
                    href={`/acara/${routine.slug}`}
                    className="hover:underline"
                  >
                    {routine.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-neutral-700">
                  {describePattern(routine.pattern, {
                    startTime: routine.startTime,
                  })}{" "}
                  · {formatJamRange(routine.startTime, routine.endTime)}
                </p>
                {next ? (
                  <p className="mt-1 text-sm text-neutral-600">
                    Berikutnya: {formatTanggal(next.date)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-amber-800">
                    Belum ada jadwal berikutnya yang terkonfirmasi
                  </p>
                )}
                <p className="mt-1 text-sm text-neutral-600">
                  {routine.venueName} — {routine.district}, {routine.city}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
