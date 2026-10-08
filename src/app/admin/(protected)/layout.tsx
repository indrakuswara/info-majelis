// Layout area admin terproteksi (plan Task 5 & Task 7) — cek sesi
// server-side sebagai lapis kedua setelah proxy; tanpa sesi valid kembali
// ke login. Kerangka ini memasang navigasi admin dan AdminShell (toast +
// indikator perubahan belum disimpan) untuk semua halaman di bawahnya.

import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ActionButton } from "../../../components/admin/ActionButton.tsx";
import { AdminShell } from "../../../components/admin/AdminShell.tsx";
import { getSessionEmail } from "../../../lib/auth.ts";
import { logoutAction } from "./actions.ts";

// cacheComponents aktif: layout ini membaca cookie sesi per request —
// opt-out dari instant navigation agar route memblokir di server
// (pola resmi Next 16 untuk auth).
export const instant = false;

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Event" },
  { href: "/admin/routines", label: "Jadwal Rutin" },
  { href: "/admin/majelis", label: "Majelis" },
  { href: "/admin/arsip", label: "Arsip" },
] as const;

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const email = await getSessionEmail();
  if (!email) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-bold">
            Admin Info Majelis
          </Link>
          <div className="flex items-center gap-4">
            <span className="max-w-56 truncate text-sm text-neutral-600">
              {email}
            </span>
            <form action={logoutAction}>
              <ActionButton
                type="submit"
                pendingLabel="Keluar…"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
              >
                Keluar
              </ActionButton>
            </form>
          </div>
        </div>
        <nav
          aria-label="Navigasi admin"
          className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <AdminShell>{children}</AdminShell>
    </div>
  );
}
