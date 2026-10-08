// Dashboard admin (plan Task 7; spec §7.2): ringkasan isi dari
// repository, pintasan tambah, dan event yang paling baru diubah.

import Link from "next/link";
import { connection } from "next/server";
import { StatusBadge } from "../../../components/admin/StatusBadge.tsx";
import {
  ensureSchema,
  listAdminEvents,
  listAdminMajelis,
  listAdminRoutines,
  listPublishedRoutines,
  listPublishedUpcoming,
  nowISODateTime,
} from "../../../lib/db.ts";
import { formatRelativeTime } from "../../../lib/utils.ts";

// Dashboard selalu membaca data terbaru dari repository.
export const instant = false;

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-neutral-600">{label}</p>
      <p className="mt-2 text-4xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-neutral-500">{description}</p>
    </section>
  );
}

export default async function AdminDashboardPage() {
  // Dashboard adalah data per-request (termasuk perhitungan "sekarang");
  // connection() menghentikan prerender sebelum waktu & DB dibaca.
  await connection();
  await ensureSchema();

  const [
    upcomingEvents,
    activeRoutines,
    draftEvents,
    draftRoutines,
    draftMajelis,
    allEvents,
  ] = await Promise.all([
    listPublishedUpcoming({ nowISO: nowISODateTime(), range: "all" }),
    listPublishedRoutines({}),
    listAdminEvents({ status: "draft" }),
    listAdminRoutines({ status: "draft" }),
    listAdminMajelis({ status: "draft" }),
    listAdminEvents({}),
  ]);

  const draftCount =
    draftEvents.length + draftRoutines.length + draftMajelis.length;
  const recentEvents = allEvents.slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-neutral-600">
            Ringkasan jadwal dan konten yang sedang Anda kelola.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Event Terbit Mendatang"
          value={upcomingEvents.length}
          description="Event published yang belum selesai."
        />
        <SummaryCard
          label="Jadwal Rutin Aktif"
          value={activeRoutines.length}
          description="Jadwal rutin published dan berstatus aktif."
        />
        <SummaryCard
          label="Draft"
          value={draftCount}
          description={`${draftEvents.length} event · ${draftRoutines.length} jadwal rutin · ${draftMajelis.length} majelis`}
        />
      </div>

      <section aria-labelledby="pintasan-tambah" className="mt-8">
        <h2 id="pintasan-tambah" className="text-lg font-bold">
          Tambah Konten
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/admin/events/new"
            className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
          >
            + Tambah Event
          </Link>
          <Link
            href="/admin/routines/new"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-semibold hover:bg-neutral-100"
          >
            + Tambah Jadwal Rutin
          </Link>
          <Link
            href="/admin/majelis/new"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-semibold hover:bg-neutral-100"
          >
            + Tambah Majelis
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="event-terakhir-diubah"
        className="mt-10 rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        <div className="border-b border-neutral-200 px-5 py-4">
          <h2 id="event-terakhir-diubah" className="text-lg font-bold">
            Event Terakhir Diubah
          </h2>
        </div>
        {recentEvents.length === 0 ? (
          <p className="px-5 py-6 text-neutral-600">
            Belum ada event. Event yang dibuat atau diubah akan muncul di
            sini.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="hover:underline"
                    >
                      {event.title}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Diubah {formatRelativeTime(event.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    Ubah
                  </Link>
                  <StatusBadge status={event.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
