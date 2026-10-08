import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sedang Luring",
  description:
    "Anda sedang tidak terhubung ke internet. Jadwal Info Majelis memerlukan koneksi untuk ditampilkan.",
  robots: { index: false, follow: false },
};

// Halaman fallback luring (plan Task 14; spec §12): ditampilkan service
// worker saat navigasi gagal total dan halaman tujuan belum pernah
// dibuka. Statis penuh — tidak membaca database — agar selalu bisa
// di-precache dan dilayani dari cache.
export default function OfflinePage() {
  return (
    <section className="mx-auto max-w-prose py-10 text-center">
      <p aria-hidden="true" className="text-5xl">
        📶
      </p>
      <h1 className="mt-4 text-2xl font-bold text-emerald-900">
        Anda sedang luring
      </h1>
      <p className="mt-3 text-neutral-700">
        Koneksi internet terputus, jadi jadwal terbaru belum bisa dimuat.
        Halaman yang pernah Anda buka sebelumnya mungkin masih bisa diakses
        dari perangkat ini.
      </p>
      <p className="mt-2 text-neutral-700">
        Periksa koneksi Anda, lalu coba lagi.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-emerald-800 px-5 py-2.5 font-semibold text-white hover:bg-emerald-900"
      >
        Coba Lagi
      </Link>
    </section>
  );
}
