import assert from "node:assert/strict";

const cred = await import("../src/lib/credentials.ts");

// --- normalizeEmail: lowercase + trim -------------------------------------
assert.equal(
  cred.normalizeEmail("  Admin@Info-Majelis.LOCAL "),
  "admin@info-majelis.local",
  "normalizeEmail harus lowercase + trim",
);
assert.equal(cred.normalizeEmail("admin@test.local"), "admin@test.local");

// --- hashPassword → verifyCredentials true --------------------------------
const hash = await cred.hashPassword("admin123");
assert.equal(typeof hash, "string");
assert.ok(hash.length > 20, "hash harus menyimpan salt + hasil scrypt");
assert.ok(
  !hash.includes("admin123"),
  "hash tidak boleh mengandung kata sandi asli",
);

// Dua hash untuk sandi yang sama harus berbeda (salt acak per hash).
const hash2 = await cred.hashPassword("admin123");
assert.notEqual(hash, hash2, "salt acak: dua hash tidak boleh identik");

assert.equal(
  await cred.verifyCredentials("admin@test.local", "admin123", hash),
  true,
  "sandi benar harus lolos",
);
assert.equal(
  await cred.verifyCredentials("admin@test.local", "admin123", hash2),
  true,
  "hash kedua (salt berbeda) juga harus lolos",
);

// --- password salah ⇒ false ------------------------------------------------
assert.equal(
  await cred.verifyCredentials("admin@test.local", "salah-password", hash),
  false,
  "sandi salah harus ditolak",
);
assert.equal(
  await cred.verifyCredentials("admin@test.local", "", hash),
  false,
  "sandi kosong harus ditolak",
);

// --- email case-insensitive -------------------------------------------------
// Alur login: email kandidat dinormalisasi sebelum dicari & diverifikasi,
// jadi variasi huruf besar/kecil + spasi tetap bisa masuk.
const storedEmail = "admin@test.local";
const candidate = "  ADMIN@Test.Local ";
assert.equal(cred.normalizeEmail(candidate), storedEmail);
assert.equal(
  await cred.verifyCredentials(candidate, "admin123", hash),
  true,
  "email dengan huruf besar/kecil berbeda harus tetap lolos",
);

// --- hash rusak / format asing ⇒ false, bukan throw -------------------------
assert.equal(
  await cred.verifyCredentials("admin@test.local", "admin123", "bukan-hash"),
  false,
);
assert.equal(await cred.verifyCredentials("admin@test.local", "admin123", ""), false);

console.log("test-credentials: SEMUA LULUS");
