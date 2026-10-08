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
      className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
    >
      Rute ke Lokasi
    </a>
  );
}
