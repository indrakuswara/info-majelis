import Link from "next/link";

export default function NotFound() {
  return (
    <section className="border border-dashed border-neutral-400 px-5 py-10 text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-red-700">
        404
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-950">
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
          className="rounded-none bg-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-700"
        >
          Lihat Acara
        </Link>
        <Link
          href="/"
          className="rounded-none border border-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-neutral-900 hover:bg-neutral-100"
        >
          Ke Beranda
        </Link>
      </div>
    </section>
  );
}
