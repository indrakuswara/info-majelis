// Placeholder daftar Majelis — CRUD & promosi penuh dikerjakan Task 8.

import Link from "next/link";

export default function AdminMajelisPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Majelis</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Profil majelis akan dikelola dari halaman ini. CRUD, pencarian,
          filter status, dan promosi nama penyelenggara manual dikerjakan
          pada Task 8.
        </p>
        <Link
          href="/admin/majelis/new"
          className="mt-5 inline-block rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          + Tambah Majelis
        </Link>
      </div>
    </main>
  );
}
