// Token sesi admin (plan Task 5) — edge-safe: hanya memakai `jose`,
// tanpa next/headers dan tanpa DB, agar dapat dipakai juga oleh proxy.ts
// (verifikasi JWT di proxy tidak boleh memakai next/headers).

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari, dalam detik

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET belum di-set di environment");
  }
  return new TextEncoder().encode(secret);
}

/** Buat JWT HS256 untuk sesi admin; klaim utama: email (subject). */
export async function signSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

/** Verifikasi JWT; kembalikan email pemilik sesi atau null bila tidak valid. */
export async function verifySessionToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.email === "string") return payload.email;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
