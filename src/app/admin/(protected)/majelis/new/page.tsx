// Placeholder tambah Majelis — formulir penuh dikerjakan Task 8.

import Link from "next/link";

export default function AdminNewMajelisPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Tambah Majelis</h1>
        <p className="mt-3 text-neutral-600">
          Formulir profil majelis akan tersedia pada Task 8, lengkap dengan
          unggah logo/foto dan validasi publish interaktif.
        </p>
        <Link
          href="/admin/majelis"
          className="mt-5 inline-block rounded-md border border-neutral-300 px-4 py-2 font-semibold hover:bg-neutral-100"
        >
          Kembali ke daftar Majelis
        </Link>
      </div>
    </main>
  );
}
