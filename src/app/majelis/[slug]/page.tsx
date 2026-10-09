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
import { RailSlot } from "../../../components/public/RailSlot.tsx";
import { UpcomingMini } from "../../../components/public/UpcomingMini.tsx";
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
import { absoluteUrl } from "../../../lib/seo.ts";
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
  const description =
    majelis.description ??
    `Profil ${majelis.name} beserta acara dan jadwal rutinnya di Info Majelis.`;
  const image = majelis.photoUrl ?? majelis.logoUrl;
  return {
    title: majelis.name,
    description,
    alternates: { canonical: `/majelis/${majelis.slug}` },
    openGraph: {
      type: "profile",
      title: `${majelis.name} — Info Majelis`,
      description,
      url: absoluteUrl(`/majelis/${majelis.slug}`),
      ...(image
        ? { images: [{ url: absoluteUrl(image), alt: majelis.name }] }
        : {}),
    },
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
        className="font-medium text-em underline underline-offset-4"
      >
        {label}
      </a>
    </li>
  );
}

const SECTION_HEADING =
  "border-b border-line pb-1.5 font-display text-lg font-semibold text-ink";
const DT_CLASS =
  "text-[11px] font-bold uppercase tracking-[0.12em] text-muted";

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
        className="text-sm font-medium text-em underline underline-offset-4"
      >
        ← Direktori majelis
      </Link>

      {/* Daftar mini "Acara Terdekat" tinggal di rail desktop / bar
          mobile lewat RailSlot; posisi di sini adalah fallback aliran
          konten tanpa JS (plan redesign Task 6). */}
      <RailSlot>
        <UpcomingMini />
      </RailSlot>

      <article>
        {headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headerImage}
            alt={`Foto atau logo ${majelis.name}`}
            className="max-h-80 w-full rounded-[2px] border border-line object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-5 pt-5">
          <div className="flex items-start gap-4 border-b border-line pb-4">
            {majelis.logoUrl && majelis.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={majelis.logoUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-[2px] border border-line object-cover"
              />
            ) : null}
            <div>
              <h1 className="font-display text-3xl font-semibold leading-tight text-ink">
                {majelis.name}
              </h1>
              <p className="mt-1 text-muted">
                {majelis.baseDistrict ? `${majelis.baseDistrict}, ` : ""}
                {majelis.city}
              </p>
              {majelis.leader ? (
                <p className="mt-1 text-sm text-muted">
                  Pimpinan: {majelis.leader}
                </p>
              ) : null}
            </div>
          </div>

          {majelis.description ? (
            <p className="whitespace-pre-line leading-relaxed text-ink">
              {majelis.description}
            </p>
          ) : null}

          <dl className="grid gap-x-6 sm:grid-cols-2">
            {majelis.baseAddress ? (
              <div className="border-t border-line py-3">
                <dt className={DT_CLASS}>Alamat Markas</dt>
                <dd className="mt-1 text-ink">
                  {majelis.baseAddress}
                  {majelis.baseDistrict || majelis.city ? (
                    <span className="block text-sm text-muted">
                      {majelis.baseDistrict ? `${majelis.baseDistrict}, ` : ""}
                      {majelis.city}
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {majelis.contact ? (
              <div className="border-t border-line py-3">
                <dt className={DT_CLASS}>Kontak</dt>
                <dd className="mt-1 whitespace-pre-line text-ink">
                  {majelis.contact}
                </dd>
                <dd className="mt-1 text-xs text-muted">
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
                className="inline-flex rounded-[2px] bg-em px-5 py-3 text-sm font-bold text-paper hover:bg-em2"
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
              <h2 className={SECTION_HEADING}>Media Sosial & Situs</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                <SocialLink label="Instagram" href={majelis.instagramUrl} />
                <SocialLink label="YouTube" href={majelis.youtubeUrl} />
                <SocialLink label="TikTok" href={majelis.tiktokUrl} />
                <SocialLink label="Situs web" href={majelis.websiteUrl} />
              </ul>
            </section>
          ) : null}

          <p className="border-t border-line pt-4 text-sm text-muted">
            Terakhir diperbarui: {formatTanggal(majelis.updatedAt)}
          </p>
        </div>
      </article>

      <section>
        <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
          <h2 className="font-display text-lg font-semibold text-ink">
            Acara Akan Datang
          </h2>
          <span className="text-sm text-muted">
            {upcomingItems.length} acara
          </span>
        </div>
        {upcomingItems.length === 0 ? (
          <p className="mt-4 border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
            Belum ada acara mendatang dari majelis ini.
          </p>
        ) : (
          <div className="mt-4 grid border-l border-t border-line lg:grid-cols-2">
            {upcomingItems.map((item) => (
              <EventCard key={item.key} item={item} todayIso={today} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className={SECTION_HEADING}>Jadwal Rutin Majelis Ini</h2>
        {routinesWithNext.length === 0 ? (
          <p className="mt-4 border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
            Majelis ini belum memiliki jadwal rutin terbit yang aktif.
          </p>
        ) : (
          <div className="mt-4 grid border-l border-t border-line">
            {routinesWithNext.map(({ routine, next }) => (
              <article
                key={routine.id}
                className="border-b border-r border-line bg-paper p-5"
              >
                <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                  <Link
                    href={`/acara/${routine.slug}`}
                    className="hover:underline"
                  >
                    {routine.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm tabular-nums text-muted">
                  {describePattern(routine.pattern, {
                    startTime: routine.startTime,
                  })}{" "}
                  · {formatJamRange(routine.startTime, routine.endTime)}
                </p>
                {next ? (
                  <p className="mt-1 text-sm text-muted">
                    Berikutnya: {formatTanggal(next.date)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-[#8a6410]">
                    Belum ada jadwal berikutnya yang terkonfirmasi
                  </p>
                )}
                <p className="mt-1 text-sm text-muted">
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
