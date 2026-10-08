// Pratinjau admin Event (plan Task 9; spec §7 butir 7): render
// tampilan detail publik dari data record TERSIMPAN — termasuk draft.
// Route ini berada di balik layout terproteksi sesi; publik tetap
// tidak dapat mengakses draft dengan cara apa pun (getter publik
// published-only di Task 4). Field sourceInfo tidak diteruskan ke
// komponen pratinjau sama sekali.

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventPreview } from "../../../../../../components/admin/EventPreview.tsx";
import { StatusBadge } from "../../../../../../components/admin/StatusBadge.tsx";
import {
  ensureSchema,
  getEventById,
  getMajelisById,
} from "../../../../../../lib/db.ts";

export const instant = false;

export default async function AdminEventPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await ensureSchema();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const organizerName = event.organizerMajelisId
    ? ((await getMajelisById(event.organizerMajelisId))?.name ?? null)
    : event.organizerNameManual;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href={`/admin/events/${event.id}`}
        className="text-sm font-medium text-emerald-800 underline"
      >
        ← Kembali ke form Event
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Pratinjau Event
        </h1>
        <StatusBadge status={event.status} />
      </div>
      <p className="mt-2 text-neutral-600">
        Pratinjau khusus admin dari data tersimpan.{" "}
        {event.status === "draft"
          ? "Event ini masih draft — halaman publiknya belum dapat diakses siapa pun."
          : "Event ini sudah terbit dan tampil ke publik."}
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <EventPreview
          data={{
            title: event.title,
            category: event.category,
            startDate: event.startDate,
            endDate: event.endDate,
            startTime: event.startTime,
            endTime: event.endTime,
            venueName: event.venueName,
            address: event.address,
            city: event.city,
            district: event.district,
            mapsUrl: event.mapsUrl,
            posterUrl: event.posterUrl,
            organizerName,
            speakers: event.speakers,
            audience: event.audience,
            liveStreamUrl: event.liveStreamUrl,
            contact: event.contact,
            extraInfo: event.extraInfo,
            libraryUrl: event.libraryUrl,
            description: event.description,
          }}
        />
      </div>
      {event.status === "published" && (
        <p className="mt-4 text-sm">
          <Link
            href={`/acara/${event.slug}`}
            className="font-medium text-emerald-800 underline"
          >
            Lihat Halaman Publik
          </Link>{" "}
          (halaman publik dibangun pada Task 12.)
        </p>
      )}
    </main>
  );
}
