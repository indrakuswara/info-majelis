"use client";

// Kerangka halaman publik di layout root (plan Task 11; spec §9):
// header nama situs + navigasi + footer dengan keterangan cakupan.
// Dibungkus komponen klien kecil agar area /admin (yang punya kerangka
// sendiri) tidak ikut mendapat header/footer publik.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SITE_COVERAGE_NOTE } from "../../lib/constants.ts";

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Beranda" },
  { href: "/acara", label: "Acara" },
  { href: "/jadwal", label: "Jadwal Rutin" },
  { href: "/majelis", label: "Majelis" },
  { href: "/arsip", label: "Arsip" },
];

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }
  return (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-emerald-800">
            Info Majelis
          </Link>
          <nav aria-label="Navigasi utama" className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-neutral-700">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href
                    ? "font-semibold text-emerald-800 underline underline-offset-4"
                    : "hover:text-emerald-800 hover:underline hover:underline-offset-4"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-neutral-600">
          <p className="font-semibold text-neutral-800">Info Majelis</p>
          <p className="mt-1 max-w-prose">
            Direktori jadwal maulid, tabligh akbar, kajian, dan acara majelis
            untuk jamaah. {SITE_COVERAGE_NOTE}
          </p>
        </div>
      </footer>
    </>
  );
}
