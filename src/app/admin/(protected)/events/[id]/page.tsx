// Edit Event (plan Task 9): form terisi data existing; penjaga §14
// (event terbit tidak boleh disimpan menjadi tidak lengkap) ditegakkan
// di saveEventAction.

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventForm } from "../../../../../components/admin/EventForm.tsx";
import { ensureSchema, getEventById } from "../../../../../lib/db.ts";
import { loadEventFormData } from "../form-data.ts";

export const instant = false;

export default async function AdminEditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await ensureSchema();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const { organizerOptions, districtSuggestionsByCity } =
    await loadEventFormData();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/events"
        className="text-sm font-medium text-emerald-800 underline"
      >
        ← Kembali ke daftar Event
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        Ubah Event: {event.title.trim() === "" ? "(Tanpa judul)" : event.title}
      </h1>
      <p className="mt-2 text-neutral-600">
        Slug publik: <code className="text-sm">{event.slug}</code>
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <EventForm
          initial={event}
          organizerOptions={organizerOptions}
          districtSuggestionsByCity={districtSuggestionsByCity}
        />
      </div>
    </main>
  );
}
