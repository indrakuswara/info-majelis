// Tombol Rute ke Lokasi (spec §10). Implementasi interaktif final
// diselesaikan di Task 13; di Task 12 tombol ini dirender pada posisi
// finalnya sebagai tautan Google Maps.

export function MapsButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
    >
      Rute ke Lokasi
    </a>
  );
}
