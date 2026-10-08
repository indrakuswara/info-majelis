import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";

// Lapisan penyimpanan gambar (spec §13.3).
// - Driver `local` (default dev): berkas di `.data/uploads/`, URL `/uploads/<key>`
//   dilayani route handler `src/app/uploads/[key]/route.ts`.
// - Driver `blob` (production): Vercel Blob, token `BLOB_READ_WRITE_TOKEN`.
// Driver dipilih lewat env `STORAGE_DRIVER` dan dibaca saat fungsi dipanggil.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageInput(i: {
  contentType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_CONTENT_TYPES.has(i.contentType)) {
    return {
      ok: false,
      error: "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.",
    };
  }
  if (i.sizeBytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Ukuran gambar melebihi batas 5 MB." };
  }
  return { ok: true };
}

/** Resize lebar maks 1600 px (tidak memperbesar) + konversi WebP kualitas 80. */
export async function processPoster(data: Buffer): Promise<Buffer> {
  return sharp(data)
    .rotate() // hormati orientasi EXIF dari foto HP
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

function sanitizeOwnerId(ownerId: string): string {
  const cleaned = ownerId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "tanpa-id";
}

/**
 * Kunci berkas gambar: deterministik, datar satu segmen
 * (`<kind>-<ownerId tersanitasi>.webp`) agar cocok dengan route
 * `/uploads/[key]` dan aman dari path traversal apa pun isi ownerId-nya.
 */
export function organizerImageKey(
  kind: "poster" | "logo" | "photo",
  ownerId: string,
): string {
  return `${kind}-${sanitizeOwnerId(ownerId)}.webp`;
}

/** Kunci unggahan sah: satu segmen, tanpa `..`, tanpa pemisah path. */
export function isSafeUploadKey(key: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key) && !key.includes("..");
}

type StorageDriver = "blob" | "local";

function storageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
}

function localUploadsDir(): string {
  return path.join(process.cwd(), ".data", "uploads");
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function putImage(
  key: string,
  data: Buffer,
): Promise<{ url: string }> {
  if (!isSafeUploadKey(key)) {
    throw new Error("Kunci berkas gambar tidak valid.");
  }
  if (storageDriver() === "blob") {
    const blob = await put(key, data, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: blob.url };
  }
  const dir = localUploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), data);
  return { url: `/uploads/${key}` };
}

export async function deleteImage(url: string): Promise<void> {
  if (storageDriver() === "blob") {
    // Hanya URL Blob yang dihapus; URL lain diabaikan (idempoten).
    if (url.startsWith("https://")) {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }
    return;
  }
  if (!url.startsWith("/uploads/")) return;
  const key = decodeURIComponent(url.slice("/uploads/".length));
  if (!isSafeUploadKey(key)) return;
  try {
    await unlink(path.join(localUploadsDir(), key));
  } catch {
    // Berkas sudah tidak ada — hapus bersifat idempoten.
  }
}

/** Baca berkas driver lokal untuk route handler `/uploads/[key]`. */
export async function readLocalImage(
  key: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isSafeUploadKey(key)) return null;
  const ext = path.extname(key).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
  try {
    const data = await readFile(path.join(localUploadsDir(), key));
    return { data, contentType };
  } catch {
    return null;
  }
}
