// Tanggal hari ini pada nameplate header publik (Task 14 fix).
// Komponen SERVER: tanggal adalah konten, jadi harus sudah ada di HTML
// hasil render server — bukan diisi klien sesudah hidrasi. Dirender dari
// layout root dan diteruskan ke SiteChrome (komponen klien) sebagai prop
// ReactNode; pola komposisi yang sah di Next: server component boleh
// dirender sebagai children/prop dari client component.
//
// connection() menghentikan prerender sebelum waktu dibaca (pola yang
// sama dengan dashboard admin Task 7); pemanggil membungkus komponen
// ini dengan <Suspense> agar halaman statis (/offline, 404) tetap bisa
// di-prerender sebagai shell dan tanggal mengalir masuk per request.
// Zona selalu Asia/Jakarta via helper format.ts — tidak pernah
// mengikuti zona mesin/perangkat, dan karena markup datang utuh dari
// server, tidak ada ketidakcocokan hidrasi.

import { connection } from "next/server";
import { formatTanggal, wibTodayISODate } from "../../lib/format.ts";

export async function NameplateDate() {
  await connection();
  const label = formatTanggal(wibTodayISODate());
  return <span className="text-xs text-neutral-500">{label}</span>;
}
