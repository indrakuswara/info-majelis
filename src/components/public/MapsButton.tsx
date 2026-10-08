// Tombol Rute ke Lokasi (spec §10) — salah satu dari HANYA dua tombol
// aksi di halaman detail. href sudah diselesaikan pemanggil lewat
// buildMapsUrl (prioritas: tautan manual admin → koordinat tersimpan
// → pencarian nama tempat + alamat).

export function MapsButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex flex-1 items-center justify-center rounded-none bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-700"
    >
      Rute ke Lokasi
    </a>
  );
}
