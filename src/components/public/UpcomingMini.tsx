// Daftar mini "Acara Terdekat" untuk slot konteks rail (spec
// redesign §6; plan redesign Task 6): tiga kemunculan terbit
// berikutnya dari feed publik yang sudah ada (getUpcomingFeed tanpa
// filter), dirender oleh halaman detail & profil dan dipindah ke
// rail desktop / bar mobile lewat RailSlot.
//
// Komponen SERVER murni presentasional di atas feed publik — tidak
// ada query baru. Gaya dasar untuk konteks terang (bar mobile &
// fallback aliran konten tanpa JS); konteks rail zamrud diatur lewat
// CSS turunan .slot-rail di globals.css, mengikuti pola .filterbar.
// Keadaan kosong: tidak merender apa pun.

import Link from "next/link";
import { getUpcomingFeed } from "../../lib/feed.ts";
import { formatTanggalSingkat } from "../../lib/format.ts";
import { nowWibISO } from "../../lib/utils.ts";

export async function UpcomingMini() {
  const items = (await getUpcomingFeed(nowWibISO())).slice(0, 3);
  if (items.length === 0) return null;

  return (
    <section className="upcoming-mini" aria-label="Acara terdekat">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
        Acara Terdekat
      </h2>
      <ul className="mt-1 flex flex-col">
        {items.map((item) => (
          <li key={item.key} className="border-t border-line py-2.5">
            <Link
              href={item.href}
              className="block font-medium leading-snug text-ink underline-offset-4 hover:text-em hover:underline"
            >
              {item.title}
            </Link>
            <p className="upcoming-mini-date mt-0.5 text-xs tabular-nums text-muted">
              {formatTanggalSingkat(item.date)} · {item.startTime} WIB —{" "}
              {item.district}, {item.city}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
