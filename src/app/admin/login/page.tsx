// Halaman login admin (plan Task 5) — server component.
// Setiap request ke halaman ini lebih dulu memastikan skema DB ada dan
// admin awal dari env sudah dibuat (titik jalan schema+seed production
// dari sisi server, Task 16).

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authenticateAdmin, createSession, ensureAdminFromEnv } from "../../../lib/auth.ts";
import { ensureSchema } from "../../../lib/db.ts";

// cacheComponents aktif: halaman ini membaca searchParams & menjalankan
// ensureSchema + seed admin per request — opt-out dari instant navigation
// agar route memblokir di server (pola resmi Next 16 untuk auth).
export const instant = false;

function safeNext(raw: string | undefined): string {
  if (!raw) return "/admin";
  try {
    // Parse terhadap base dummy agar path traversal (`/admin/../`),
    // URL absolut/`//host` eksternal, dan prefix palsu (`/administrator`)
    // dinormalisasi lebih dulu, baru jalurnya diperiksa persis.
    const { pathname } = new URL(raw, "http://info-majelis.local");
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return pathname;
    }
  } catch {
    // string yang tidak dapat di-parse sebagai URL: fallback di bawah.
  }
  return "/admin";
}

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/admin"));

  const okEmail = await authenticateAdmin(email, password);
  if (!okEmail) {
    const params = new URLSearchParams({ error: "1", next });
    redirect(`/admin/login?${params.toString()}`);
  }
  await createSession(okEmail);
  redirect(next);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // Prerender berhenti di sini: skema + seed admin (yang memanggil
  // randomBytes untuk hashing) hanya boleh jalan saat request beneran,
  // bukan saat build — tanpa ini build Vercel gagal di halaman ini
  // karena DB build masih kosong sehingga jalur seed terpicu.
  await connection();
  await ensureSchema();
  await ensureAdminFromEnv();

  const params = await searchParams;
  const next = safeNext(params.next);
  const showError = params.error === "1";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Masuk Admin</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Area khusus admin Info Majelis. Jamaah tidak perlu masuk untuk
        melihat jadwal.
      </p>

      {showError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          Email atau kata sandi salah.
        </p>
      )}

      <form action={loginAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
            placeholder="admin@info-majelis.local"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kata Sandi
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          Masuk
        </button>
      </form>
    </main>
  );
}
