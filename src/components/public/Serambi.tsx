"use client";

// Kerangka halaman publik "Serambi" (spec redesign §5–§7): rail
// samping zamrud tetap di desktop (≥1024px) berisi aksen Arab,
// nameplate, tanggal (server), tagline, navigasi vertikal, slot
// konteks (lihat RailSlot), dan kutipan di dasarnya; di mobile rail
// menjadi header atas ringkas dan kutipan pindah ke footer konten.
// Menggantikan SiteChrome; tetap komponen klien kecil yang
// mengecualikan diri pada /admin (kerangka admin terpisah) dan tetap
// merender ServiceWorkerRegister.
//
// Gaya: Klasik Islami modern — Fraunces untuk nameplate, Public Sans
// untuk isi, Amiri hanya untuk aksen Arab. Ornamen bintang-8 hanya di
// rail & footer konten; isi bersih. Elemen akar memakai kelas
// `serambi-shell` agar aturan :focus-visible emas di globals.css
// berlaku (dan hanya di dalam shell ini).

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SITE_COVERAGE_NOTE } from "../../lib/constants.ts";
import { ServiceWorkerRegister } from "../pwa/ServiceWorkerRegister.tsx";
import { Ornament } from "./Ornament.tsx";

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Beranda" },
  { href: "/acara", label: "Acara" },
  { href: "/jadwal", label: "Jadwal Rutin" },
  { href: "/majelis", label: "Majelis" },
  { href: "/arsip", label: "Arsip" },
];

const TAGLINE =
  "Jadwal Maulid, Tabligh Akbar & Kajian — Bekasi Raya dan Jakarta Timur.";

function QuoteText({ onDark }: { onDark?: boolean }) {
  // Di atas zamrud (rail) kutipan beraksen gold-soft; di atas ivory
  // (footer mobile) aksennya zamrud agar kontras tetap lolos (§10).
  return (
    <>
      <span className={onDark ? "italic text-goldsoft" : "italic text-em"}>
        &quot;Barangsiapa menempuh jalan untuk mencari ilmu…&quot;
      </span>{" "}
      — dibagikan untuk jamaah, gratis.
    </>
  );
}

export function Serambi({
  children,
  nameplateDate,
}: {
  children: ReactNode;
  // Tanggal hari ini pada nameplate, dirender di server oleh
  // NameplateDate (lihat komponen itu) dan diteruskan dari layout
  // root — tanggal adalah konten sehingga wajib sudah ada di HTML
  // server, bukan diisi klien sesudah hidrasi.
  nameplateDate?: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }
  return (
    <div className="serambi-shell flex min-h-full flex-1 flex-col bg-paper font-body text-ink lg:flex-row">
      <ServiceWorkerRegister />

      {/* Header mobile (<1024px): versi ringkas rail sebagai blok atas. */}
      <header className="relative overflow-hidden bg-em text-ivory lg:hidden">
        <Ornament className="pointer-events-none absolute inset-0 h-full w-full text-goldsoft opacity-10" />
        <div className="relative px-5 pb-4 pt-5">
          <p aria-hidden="true" className="font-arab text-xl leading-none text-goldsoft">
            مجلس
          </p>
          <Link
            href="/"
            className="mt-2 block font-display text-[22px] font-semibold uppercase leading-none tracking-[0.05em] text-paper"
          >
            Info Majelis
          </Link>
          <div className="mt-1.5">{nameplateDate}</div>
          <nav aria-label="Navigasi utama" className="mt-3 flex overflow-x-auto">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex min-h-10 items-center whitespace-nowrap border-b-2 border-goldsoft px-1 mr-4 text-[13.5px] font-bold text-white"
                      : "flex min-h-10 items-center whitespace-nowrap border-b-2 border-transparent px-1 mr-4 text-[13.5px] text-[#cfe0d2] hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Wadah slot konteks untuk mobile (diisi RailSlot lewat portal).
          Saat kosong wadah hilang total agar tidak menyisakan ruang/
          garis hantu; kelas empty: gugur sendiri begitu portal terisi. */}
      <div id="bar-slot" className="slot-bar empty:hidden lg:hidden" />

      {/* Rail desktop (≥1024px): sticky setinggi layar, gulir internal. */}
      <aside className="relative hidden w-[300px] shrink-0 bg-em text-ivory lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
        <Ornament className="pointer-events-none absolute inset-0 h-full w-full text-goldsoft opacity-10" />
        <div className="relative flex min-h-full flex-col px-7 pt-9">
          <p aria-hidden="true" className="font-arab text-[26px] leading-none text-goldsoft">
            مجلس
          </p>
          <Link
            href="/"
            className="mt-2.5 font-display text-[31px] font-semibold uppercase leading-tight tracking-[0.06em] text-paper"
          >
            Info Majelis
          </Link>
          <div className="mt-1.5">{nameplateDate}</div>
          <p className="mt-3.5 border-t border-goldsoft/45 pt-3.5 text-[12.5px] leading-relaxed text-[#b9cabb]">
            {TAGLINE}
          </p>
          <nav aria-label="Navigasi utama" className="mt-[26px] flex flex-col">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "border-l-2 border-goldsoft py-2.5 pl-3.5 text-[15px] font-bold tracking-[0.02em] text-white"
                      : "border-l-2 border-ivory/20 py-2.5 pl-3.5 text-[15px] font-medium tracking-[0.02em] text-ivory hover:border-goldsoft/60 hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Wadah slot konteks desktop (diisi RailSlot lewat portal).
              Garis & jarak atas hanya berlaku saat terisi — empty:
              menyembunyikan wadah kosong, dan gugur begitu portal
              memasukkan isinya. */}
          <div id="rail-slot" className="slot-rail mt-7 border-t border-ivory/15 pt-5 empty:hidden" />

          <div className="mt-auto pt-8">
            <p className="border-t border-goldsoft/40 py-5 text-[12.5px] leading-relaxed text-[#dfe7da]">
              <QuoteText onDark />
            </p>
          </div>
        </div>
      </aside>

      {/* Kolom konten + footer konten. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1140px] flex-1 px-4 py-6 lg:px-10 lg:py-9">
          {children}
        </main>
        <footer className="relative overflow-hidden border-t border-line bg-ivory">
          <Ornament className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full text-gold opacity-15" />
          <div className="relative mx-auto w-full max-w-[1140px] px-4 py-6 text-sm text-muted lg:px-10">
            {/* Kutipan hanya di footer pada mobile; di desktop ia
                tinggal di dasar rail (spec redesign §7). */}
            <p className="border-b border-line pb-4 text-[13px] italic leading-relaxed lg:hidden">
              <QuoteText />
            </p>
            <p className="mt-4 font-display font-semibold uppercase tracking-wide text-ink lg:mt-0">
              Info Majelis
            </p>
            <p className="mt-1 max-w-prose">
              Direktori jadwal maulid, tabligh akbar, kajian, dan acara
              majelis untuk jamaah. {SITE_COVERAGE_NOTE}
            </p>
            <nav
              aria-label="Navigasi kaki halaman"
              className="mt-4 flex flex-wrap gap-x-5 gap-y-1"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted underline-offset-4 hover:text-em hover:underline"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="mt-4 border-t border-line pt-3 text-xs">
              Info Majelis — dibagikan untuk jamaah, gratis.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
