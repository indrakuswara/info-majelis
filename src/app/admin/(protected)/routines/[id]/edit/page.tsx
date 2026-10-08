// Edit Jadwal Rutin (plan Task 10): form terisi data existing +
// bagian Pengecualian (spec §7 butir 5). Penjaga §14 (rutin terbit
// tidak boleh disimpan menjadi tidak lengkap) ditegakkan di
// saveRoutineAction. Dropdown tanggal pengecualian = 12 kemunculan
// berikutnya dari pola tersimpan yang belum berpengecualian —
// dihitung server dengan computeOccurrences yang sama seperti form.

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RoutineExceptions } from "../../../../../../components/admin/RoutineExceptions.tsx";
import { RoutineForm } from "../../../../../../components/admin/RoutineForm.tsx";
import { formatEventDateLabel } from "../../../../../../components/admin/EventPreview.tsx";
import {
  ensureSchema,
  getRoutineById,
  listRoutineExceptions,
} from "../../../../../../lib/db.ts";
import { computeOccurrences } from "../../../../../../lib/recurrence.ts";
import { nowWibISO } from "../../../../../../lib/utils.ts";
import { loadRoutineFormData } from "../../form-data.ts";

export const instant = false;

export default async function AdminEditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await ensureSchema();
  const { id } = await params;
  const routine = await getRoutineById(id);
  if (!routine) notFound();

  const [{ organizerOptions, districtSuggestionsByCity }, exceptions] =
    await Promise.all([
      loadRoutineFormData(),
      listRoutineExceptions(routine.id),
    ]);

  const exceptedDates = new Set(exceptions.map((e) => e.date));
  let occurrenceOptions: { date: string; label: string }[] = [];
  try {
    occurrenceOptions = computeOccurrences(routine, [], nowWibISO(), 12)
      .filter((occurrence) => !exceptedDates.has(occurrence.date))
      .map((occurrence) => ({
        date: occurrence.date,
        label: formatEventDateLabel(occurrence.date),
      }));
  } catch {
    occurrenceOptions = [];
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/routines"
        className="text-sm font-medium text-emerald-800 underline"
      >
        ← Kembali ke daftar Jadwal Rutin
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        Ubah Jadwal Rutin:{" "}
        {routine.title.trim() === "" ? "(Tanpa judul)" : routine.title}
      </h1>
      <p className="mt-2 text-neutral-600">
        Slug publik: <code className="text-sm">{routine.slug}</code>
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <RoutineForm
          initial={routine}
          organizerOptions={organizerOptions}
          districtSuggestionsByCity={districtSuggestionsByCity}
          exceptions={exceptions}
        />
      </div>
      <RoutineExceptions
        routineId={routine.id}
        routineStatus={routine.status}
        exceptions={exceptions}
        occurrenceOptions={occurrenceOptions}
      />
    </main>
  );
}
