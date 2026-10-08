// Layout area admin terproteksi (plan Task 5) — cek sesi server-side
// sebagai lapis kedua setelah proxy; tanpa sesi valid kembali ke login.

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionEmail } from "../../../lib/auth.ts";
import { logoutAction } from "./actions.ts";

// cacheComponents aktif: layout ini membaca cookie sesi per request —
// opt-out dari instant navigation agar route memblokir di server
// (pola resmi Next 16 untuk auth).
export const instant = false;

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const email = await getSessionEmail();
  if (!email) redirect("/admin/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <p className="font-semibold">Admin Info Majelis</p>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">{email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
