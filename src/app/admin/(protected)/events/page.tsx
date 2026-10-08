// Placeholder daftar Event — daftar & pengelolaan penuh dikerjakan Task 9.

import Link from "next/link";

export default function AdminEventsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Event</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Daftar event sekali jalan akan dikelola dari halaman ini. Daftar,
          pencarian, dan filter status dikerjakan pada Task 9.
        </p>
        <Link
          href="/admin/events/new"
          className="mt-5 inline-block rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          + Tambah Event
        </Link>
      </div>
    </main>
  );
}
