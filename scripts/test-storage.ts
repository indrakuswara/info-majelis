import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Driver lokal untuk seluruh test (dibaca storage.ts saat fungsi dipanggil).
process.env.STORAGE_DRIVER = "local";

const {
  validateImageInput,
  processPoster,
  putImage,
  deleteImage,
  organizerImageKey,
  isSafeUploadKey,
} = await import("../src/lib/storage.ts");
const { GET } = await import("../src/app/uploads/[key]/route.ts");

const MB = 1024 * 1024;

// --- validateImageInput ---------------------------------------------------------
// PDF ditolak.
{
  const r = validateImageInput({ contentType: "application/pdf", sizeBytes: 1000 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /JPG, PNG, atau WebP/);
}
// GIF juga ditolak (di luar daftar plan).
assert.equal(validateImageInput({ contentType: "image/gif", sizeBytes: 1000 }).ok, false);
// 6 MB ditolak walau formatnya benar.
{
  const r = validateImageInput({ contentType: "image/jpeg", sizeBytes: 6 * MB });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /5 MB/);
}
// Tepat 5 MB diterima; JPEG/PNG/WebP 1 MB diterima.
assert.equal(validateImageInput({ contentType: "image/jpeg", sizeBytes: 5 * MB }).ok, true);
assert.equal(validateImageInput({ contentType: "image/jpeg", sizeBytes: 1 * MB }).ok, true);
assert.equal(validateImageInput({ contentType: "image/png", sizeBytes: 1 * MB }).ok, true);
assert.equal(validateImageInput({ contentType: "image/webp", sizeBytes: 1 * MB }).ok, true);

// --- processPoster ---------------------------------------------------------------
// Fixture PNG 2400px dibuat dengan sharp → hasil WebP lebar 1600.
{
  const fixture = await sharp({
    create: {
      width: 2400,
      height: 1200,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
  const out = await processPoster(fixture);
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1600);
}
// Gambar kecil 800px TIDAK diperbesar.
{
  const fixture = await sharp({
    create: {
      width: 800,
      height: 400,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();
  const out = await processPoster(fixture);
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 800);
}

// --- organizerImageKey -----------------------------------------------------------
// Unik per panggilan (URL berubah setiap gambar diganti → tidak ada cache
// basi di browser/CDN), datar (satu segmen path), aman dari ownerId jahat.
assert.match(organizerImageKey("poster", "abc123"), /^poster-abc123-[0-9a-f]{12}\.webp$/);
assert.match(organizerImageKey("logo", "Majelis Nurul"), /^logo-majelis-nurul-[0-9a-f]{12}\.webp$/);
assert.notEqual(organizerImageKey("poster", "abc123"), organizerImageKey("poster", "abc123"));
{
  const evil = organizerImageKey("photo", "../../etc/passwd");
  assert.match(evil, /^photo-etc-passwd-[0-9a-f]{12}\.webp$/);
  assert.ok(!evil.includes(".."), "key tidak boleh mengandung ..");
  assert.ok(!evil.includes("/"), "key harus satu segmen datar");
  assert.ok(isSafeUploadKey(evil));
}
assert.match(organizerImageKey("poster", ""), /^poster-tanpa-id-[0-9a-f]{12}\.webp$/);

// --- isSafeUploadKey (dipakai route handler) -------------------------------------
assert.equal(isSafeUploadKey("poster-abc123.webp"), true);
assert.equal(isSafeUploadKey("../secret"), false);
assert.equal(isSafeUploadKey(".."), false);
assert.equal(isSafeUploadKey("a/b"), false);
assert.equal(isSafeUploadKey("a\\b"), false);
assert.equal(isSafeUploadKey(""), false);

// --- Driver local: put → ada & URL benar; route handler melayani; delete → hilang
const key = organizerImageKey("poster", "test-storage");
const filePath = path.join(process.cwd(), ".data", "uploads", key);
const payload = Buffer.from("isi-gambar-uji");
{
  const { url } = await putImage(key, payload);
  assert.equal(url, `/uploads/${key}`);
  assert.ok(existsSync(filePath), "berkas harus ada di .data/uploads");

  const res = await GET(new Request(`http://local${url}`), {
    params: Promise.resolve({ key }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/webp");
  assert.equal(Buffer.from(await res.arrayBuffer()).toString(), "isi-gambar-uji");

  await deleteImage(url);
  assert.ok(!existsSync(filePath), "berkas harus hilang setelah deleteImage");
  // delete idempoten: menghapus URL yang sudah tidak ada tidak melempar error.
  await deleteImage(url);
}

// --- Route handler: traversal & berkas tidak ada ⇒ 404 ---------------------------
for (const badKey of ["../secret", "..", "a/b"]) {
  const res = await GET(new Request("http://local/uploads/x"), {
    params: Promise.resolve({ key: badKey }),
  });
  assert.equal(res.status, 404, `key traversal ${badKey} harus 404`);
}
{
  const res = await GET(new Request("http://local/uploads/tidak-ada.webp"), {
    params: Promise.resolve({ key: "tidak-ada.webp" }),
  });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type")?.includes("image"), false);
}

console.log("test-storage: OK");
