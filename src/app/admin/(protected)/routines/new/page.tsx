// Placeholder tambah Jadwal Rutin — formulir penuh dikerjakan Task 10.

import Link from "next/link";

export default function AdminNewRoutinePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Tambah Jadwal Rutin</h1>
        <p className="mt-3 text-neutral-600">
          Formulir jadwal rutin akan tersedia pada Task 10, lengkap dengan
          pola mingguan/bulanan, pengecualian libur, dan edisi spesial.
        </p>
        <Link
          href="/admin/routines"
          className="mt-5 inline-block rounded-md border border-neutral-300 px-4 py-2 font-semibold hover:bg-neutral-100"
        >
          Kembali ke daftar Jadwal Rutin
        </Link>
      </div>
    </main>
  );
}
