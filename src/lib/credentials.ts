// Logika kredensial admin (plan Task 5) — MURNI, tanpa next/headers dan
// tanpa akses DB, agar bisa di-unit-test dengan Node murni.
//
// Hash memakai scrypt bawaan Node (bukan dependensi eksternal). Format
// simpan: `scrypt$<N>$<saltHex>$<derivedHex>` — salt acak 16 byte per hash
// dan parameter N ikut disimpan agar format tetap terbaca bila parameter
// dinaikkan di masa depan. Perbandingan hasil derive memakai
// timingSafeEqual.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Normalisasi email: trim + lowercase. Dipakai konsisten di seluruh alur auth. */
export function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verifikasi kredensial terhadap hash tersimpan. Email dinormalisasi
 * (alur login mencari admin memakai email ternormalisasi yang sama);
 * verifikasi sandi dilakukan timing-safe terhadap hash. Hash rusak /
 * format asing mengembalikan false, tidak melempar error.
 */
export async function verifyCredentials(
  email: string,
  password: string,
  storedHash: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password || !storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  if (!Number.isInteger(n) || n <= 1) return false;
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scryptAsync(password, salt, expected.length, {
    N: n,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
