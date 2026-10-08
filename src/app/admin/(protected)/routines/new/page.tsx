// Tambah Jadwal Rutin (plan Task 10): form rutin kosong; record baru
// selalu lahir sebagai draft lewat saveRoutineAction dari RoutineForm.
// Pengecualian baru dapat ditambah setelah rutin tersimpan (halaman
// edit), karena pengecualian menempel pada record yang sudah ada.

import Link from "next/link";
import { RoutineForm } from "../../../../../components/admin/RoutineForm.tsx";
import { ensureSchema } from "../../../../../lib/db.ts";
import { loadRoutineFormData } from "../form-data.ts";

export const instant = false;

export default async function AdminNewRoutinePage() {
  await ensureSchema();
  const { organizerOptions, districtSuggestionsByCity } =
    await loadRoutineFormData();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/routines"
        className="text-sm font-medium text-emerald-800 underline"
      >
        ← Kembali ke daftar Jadwal Rutin
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        Tambah Jadwal Rutin
      </h1>
      <p className="mt-2 text-neutral-600">
        Draft boleh disimpan setengah jadi. Untuk menerbitkan, field
        bertanda * wajib terisi (tanggal diganti pola pengulangan) —
        dialog Terbitkan akan memeriksanya. Pengecualian libur / edisi
        spesial ditambahkan dari halaman edit setelah jadwal tersimpan.
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <RoutineForm
          initial={null}
          organizerOptions={organizerOptions}
          districtSuggestionsByCity={districtSuggestionsByCity}
        />
      </div>
    </main>
  );
}
