// Placeholder publik /jadwal — daftar jadwal rutin penuh dibangun di
// Task 12 (spec §9.4). Halaman ini menjaga navigasi tetap utuh.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jadwal Rutin",
  description: "Daftar jadwal rutin majelis — segera hadir di Info Majelis.",
};

export default function JadwalPlaceholderPage() {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
      <h1 className="text-xl font-bold text-neutral-900">Jadwal Rutin</h1>
      <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
        Halaman daftar jadwal rutin segera hadir. Untuk sekarang, kemunculan
        jadwal rutin sudah tampil tercampur di beranda dan daftar acara.
      </p>
      <Link
        href="/acara"
        className="mt-4 inline-block rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Lihat Semua Acara
      </Link>
    </section>
  );
}
