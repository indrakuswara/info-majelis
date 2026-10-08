// Edit Majelis (plan Task 8): form terisi data existing + jumlah
// event/rutin terhubung untuk dialog hapus (spec §8 — penghapusan
// profil tidak menghapus event/rutinnya, hubungannya menjadi kosong).

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MajelisForm } from "../../../../../components/admin/MajelisForm.tsx";
import {
  ensureSchema,
  getMajelisById,
  listAdminEvents,
  listAdminRoutines,
  listKnownDistricts,
} from "../../../../../lib/db.ts";

export const instant = false;

export default async function AdminEditMajelisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await ensureSchema();
  const { id } = await params;
  const majelis = await getMajelisById(id);
  if (!majelis) notFound();

  const [events, routines, districtSuggestions] = await Promise.all([
    listAdminEvents({}),
    listAdminRoutines({}),
    majelis.city ? listKnownDistricts(majelis.city) : Promise.resolve([]),
  ]);
  const linkedEvents = events.filter(
    (event) => event.organizerMajelisId === majelis.id,
  ).length;
  const linkedRoutines = routines.filter(
    (routine) => routine.organizerMajelisId === majelis.id,
  ).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/majelis"
        className="text-sm font-medium text-emerald-800 underline"
      >
        ← Kembali ke daftar Majelis
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        Ubah Majelis: {majelis.name}
      </h1>
      <p className="mt-2 text-neutral-600">
        Terhubung ke {linkedEvents} event dan {linkedRoutines} jadwal rutin.
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <MajelisForm
          initial={majelis}
          linkedEvents={linkedEvents}
          linkedRoutines={linkedRoutines}
          districtSuggestions={districtSuggestions}
        />
      </div>
    </main>
  );
}
