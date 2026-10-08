// Placeholder publik /majelis — direktori majelis dibangun di
// Task 12 (spec §9.3). Halaman ini menjaga navigasi tetap utuh.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Direktori Majelis",
  description: "Direktori profil majelis — segera hadir di Info Majelis.",
};

export default function MajelisPlaceholderPage() {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
      <h1 className="text-xl font-bold text-neutral-900">Direktori Majelis</h1>
      <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
        Halaman direktori majelis segera hadir. Untuk sekarang, silakan
        telusuri acara dari majelis-majelis yang sudah terbit di daftar
        acara.
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
