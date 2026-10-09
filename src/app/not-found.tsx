import Link from "next/link";

export default function NotFound() {
  return (
    <section className="border border-dashed border-line bg-ivory px-5 py-10 text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-gold">
        404
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
        Halaman tidak ditemukan
      </h1>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Acara, jadwal, atau profil yang Anda cari tidak tersedia. Konten
        mungkin masih berupa draft, sudah dihapus, atau alamatnya tidak
        tepat.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/acara"
          className="rounded-[2px] bg-em px-5 py-2 text-xs font-bold uppercase tracking-wider text-paper hover:bg-em2"
        >
          Lihat Acara
        </Link>
        <Link
          href="/"
          className="rounded-[2px] border border-em px-5 py-2 text-xs font-bold uppercase tracking-wider text-em hover:bg-ivory"
        >
          Ke Beranda
        </Link>
      </div>
    </section>
  );
}
