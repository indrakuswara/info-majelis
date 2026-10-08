// Sesi admin tunggal (plan Task 5). Memakai next/headers — hanya untuk
// kode server (server component / server action), bukan proxy.
// Verifikasi token murni ada di session.ts (edge-safe, dipakai proxy).

import { cookies } from "next/headers";
import { countAdmins, createAdmin, getAdminByEmail } from "./db.ts";
import { hashPassword, normalizeEmail, verifyCredentials } from "./credentials.ts";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  verifySessionToken,
} from "./session.ts";

export { SESSION_COOKIE, SESSION_MAX_AGE };

export async function createSession(email: string): Promise<void> {
  const token = await signSessionToken(normalizeEmail(email));
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Verifikasi pasangan email + kata sandi terhadap tabel admins.
 * Kembalikan email ternormalisasi bila cocok, null bila tidak
 * (pemanggil menampilkan pesan error generik yang sama untuk
 * email tidak dikenal maupun sandi salah).
 */
export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return null;
  const admin = await getAdminByEmail(normalized);
  if (!admin) return null;
  const ok = await verifyCredentials(normalized, password, admin.passwordHash);
  return ok ? normalized : null;
}

/**
 * Seed admin dari env: bila tabel admins masih kosong DAN env
 * ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD terisi, buat admin tersebut.
 * Dipanggil server-side dari halaman login (setelah ensureSchema) —
 * inilah titik jalan seed di production dari sisi server Vercel,
 * tanpa rute seed sementara.
 */
export async function ensureAdminFromEnv(): Promise<void> {
  const count = await countAdmins();
  if (count > 0) return;
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) return;
  try {
    await createAdmin({
      email: normalizeEmail(email),
      passwordHash: await hashPassword(password),
    });
  } catch {
    // Dua request login bersamaan bisa sama-sama melihat tabel kosong;
    // yang kalah balapan menabrak UNIQUE email — abaikan, admin sudah ada.
    if ((await countAdmins()) === 0) throw new Error("Gagal membuat admin awal");
  }
}
