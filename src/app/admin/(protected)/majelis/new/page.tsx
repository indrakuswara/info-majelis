// Tambah Majelis (plan Task 8): form profil kosong; record baru selalu
// lahir sebagai draft lewat saveMajelisAction dari MajelisForm.

import Link from "next/link";
import { MajelisForm } from "../../../../../components/admin/MajelisForm.tsx";
import { ensureSchema } from "../../../../../lib/db.ts";

export const instant = false;

export default async function AdminNewMajelisPage() {
  await ensureSchema();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/majelis"
        className="text-sm font-medium text-emerald-800 underline"
      >
        ← Kembali ke daftar Majelis
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Tambah Majelis</h1>
      <p className="mt-2 text-neutral-600">
        Draft boleh disimpan setengah jadi. Untuk menerbitkan, nama majelis
        dan kota/kabupaten basis wajib terisi.
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <MajelisForm initial={null} />
      </div>
    </main>
  );
}
