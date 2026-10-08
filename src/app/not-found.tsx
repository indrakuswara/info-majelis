import Link from "next/link";

export default function NotFound() {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold text-neutral-950">
        Halaman tidak ditemukan
      </h1>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-neutral-600">
        Acara, jadwal, atau profil yang Anda cari tidak tersedia. Konten
        mungkin masih berupa draft, sudah dihapus, atau alamatnya tidak
        tepat.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/acara"
          className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Lihat Acara
        </Link>
        <Link
          href="/"
          className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Ke Beranda
        </Link>
      </div>
    </section>
  );
}
