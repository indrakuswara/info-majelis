// Daftar Event admin (plan Task 9; spec §7.3): filter status +
// kategori + cari, badge status, dan badge "Lewat" untuk event terbit
// yang waktu selesainya sudah lewat (status lewat diturunkan dari
// tanggal oleh repository, tidak disimpan).

import Link from "next/link";
import { connection } from "next/server";
import { StatusBadge } from "../../../../components/admin/StatusBadge.tsx";
import {
  formatEventDateLabel,
  formatEventTimeLabel,
} from "../../../../components/admin/EventPreview.tsx";
import { CATEGORIES } from "../../../../lib/constants.ts";
import {
  ensureSchema,
  eventEndTs,
  listAdminEvents,
  wibNowTs,
} from "../../../../lib/db.ts";
import type { ContentStatus } from "../../../../lib/domain.ts";
import {
  EVENT_DRAFT_PLACEHOLDER_DATE,
  formatRelativeTime,
} from "../../../../lib/utils.ts";

export const instant = false;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua status" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Terbit" },
];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  await connection();
  await ensureSchema();
  const params = await searchParams;
  const status = STATUS_OPTIONS.some((o) => o.value === params.status)
    ? (params.status ?? "")
    : "";
  const category = CATEGORIES.some((c) => c.value === params.category)
    ? (params.category ?? "")
    : "";
  const q = (params.q ?? "").trim();

  const allEvents = await listAdminEvents({
    status: status === "" ? undefined : (status as ContentStatus),
    q: q === "" ? undefined : q,
  });
  const events =
    category === ""
      ? allEvents
      : allEvents.filter((event) => event.category === category);
  const nowTs = wibNowTs();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event</h1>
          <p className="mt-2 text-neutral-600">
            Event sekali jalan: tabligh akbar, maulid akbar, haul, dan
            lainnya. Draft tidak tampil ke publik.
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          + Tambah Event
        </Link>
      </div>

      <form
        method="get"
        className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kategori
          <select
            name="category"
            defaultValue={category}
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
          >
            <option value="">Semua kategori</option>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Cari
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Judul event, penyelenggara, atau tempat…"
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"
          >
            Terapkan
          </button>
          {(status !== "" || category !== "" || q !== "") && (
            <Link
              href="/admin/events"
              className="rounded-md border border-neutral-300 px-4 py-2 font-semibold hover:bg-neutral-100"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <section
        aria-label="Daftar event"
        className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        {events.length === 0 ? (
          <p className="px-5 py-6 text-neutral-600">
            {status !== "" || category !== "" || q !== ""
              ? "Tidak ada event yang cocok dengan filter. Coba ubah kata kunci, status, atau kategori."
              : "Belum ada event. Tambahkan lewat tombol \"+ Tambah Event\"."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {events.map((event) => {
              const isPast =
                event.status === "published" && eventEndTs(event) <= nowTs;
              return (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {event.title.trim() === ""
                        ? "(Tanpa judul)"
                        : event.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {CATEGORIES.find((c) => c.value === event.category)
                        ?.label ?? "Kategori belum dipilih"}{" "}
                      ·{" "}
                      {event.startDate === EVENT_DRAFT_PLACEHOLDER_DATE
                        ? "Tanggal belum diisi"
                        : `${formatEventDateLabel(event.startDate)}, ${formatEventTimeLabel(event.startTime, event.endTime)}`}{" "}
                      · {event.venueName || "Tempat belum diisi"} · Diubah{" "}
                      {formatRelativeTime(event.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={event.status} />
                    {isPast && (
                      <span className="inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                        Lewat
                      </span>
                    )}
                    <Link
                      href={`/admin/events/${event.id}/preview`}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
                    >
                      Pratinjau
                    </Link>
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
                    >
                      Ubah
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
