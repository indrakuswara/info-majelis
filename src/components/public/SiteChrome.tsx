"use client";

// Kerangka halaman publik di layout root (plan Task 11; spec §9):
// header nama situs + navigasi + footer dengan keterangan cakupan.
// Dibungkus komponen klien kecil agar area /admin (yang punya kerangka
// sendiri) tidak ikut mendapat header/footer publik.
//
// Gaya mengikuti arah Kalender Dinding (Task 14): header berupa
// nameplate koran — garis tinta tebal di atas, nama situs tegas dengan
// tanggal hari ini di kanan, garis ganda di bawahnya, lalu baris
// keterangan cakupan dan navigasi berhuruf kapital. Latar kertas putih
// hangat tanpa kartu berbayang.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { SITE_COVERAGE_NOTE } from "../../lib/constants.ts";
import { ServiceWorkerRegister } from "../pwa/ServiceWorkerRegister.tsx";

/** Label tanggal hari ini dalam WIB, mis. "Kamis, 8 Oktober 2026". */
function wibTodayLabel(): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Beranda" },
  { href: "/acara", label: "Acara" },
  { href: "/jadwal", label: "Jadwal Rutin" },
  { href: "/majelis", label: "Majelis" },
  { href: "/arsip", label: "Arsip" },
];

const subscribeNoop = () => () => {};

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Tanggal nameplate hanya dibaca di klien (snapshot server = null,
  // jadi tidak ada ketidakcocokan hidrasi) dengan zona Asia/Jakarta
  // eksplisit agar tidak bergeser oleh zona waktu perangkat — halaman
  // statis seperti 404 pun tetap bisa di-prerender tanpa membaca
  // waktu di server.
  const todayLabel = useSyncExternalStore(
    subscribeNoop,
    () => wibTodayLabel(),
    () => null,
  );
  if (pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fffef8] text-neutral-900">
      <ServiceWorkerRegister />
      <header>
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="border-t-[6px] border-neutral-900 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-neutral-900 pb-2">
              <Link
                href="/"
                className="text-xl font-extrabold uppercase leading-none tracking-tight text-neutral-900"
              >
                Info Majelis
              </Link>
              {todayLabel ? (
                <span className="text-xs text-neutral-500">{todayLabel}</span>
              ) : null}
            </div>
            <p className="border-b border-[#e3e0d5] py-1.5 text-xs text-neutral-500">
              {SITE_COVERAGE_NOTE}
            </p>
            <nav
              aria-label="Navigasi utama"
              className="flex flex-wrap gap-x-5 gap-y-1 py-2.5 text-[13px] font-semibold uppercase tracking-wide"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    pathname === item.href
                      ? "font-bold text-neutral-900 underline decoration-2 underline-offset-4"
                      : "text-neutral-500 hover:text-neutral-900 hover:underline hover:underline-offset-4"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t-2 border-neutral-900">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-neutral-600">
          <p className="font-extrabold uppercase tracking-wide text-neutral-900">
            Info Majelis
          </p>
          <p className="mt-1 max-w-prose">
            Direktori jadwal maulid, tabligh akbar, kajian, dan acara majelis
            untuk jamaah. {SITE_COVERAGE_NOTE}
          </p>
          <p className="mt-4 border-t border-[#e3e0d5] pt-3 text-xs italic text-neutral-500">
            {
              '"Barangsiapa menempuh jalan untuk mencari ilmu…" — dibagikan untuk jamaah, gratis.'
            }
          </p>
        </div>
      </footer>
    </div>
  );
}
