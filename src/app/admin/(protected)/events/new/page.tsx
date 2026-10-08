// Placeholder tambah Event — formulir penuh dikerjakan Task 9.

import Link from "next/link";

export default function AdminNewEventPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Tambah Event</h1>
        <p className="mt-3 text-neutral-600">
          Formulir event sekali jalan akan tersedia pada Task 9, lengkap
          dengan simpan draft, validasi publish interaktif, dan pratinjau.
        </p>
        <Link
          href="/admin/events"
          className="mt-5 inline-block rounded-md border border-neutral-300 px-4 py-2 font-semibold hover:bg-neutral-100"
        >
          Kembali ke daftar Event
        </Link>
      </div>
    </main>
  );
}
