// Server action unggah gambar bersama (plan Task 8; dipakai Task 8–10).
// Klien tidak pernah memegang token storage: berkas dikirim ke server,
// sesi diperiksa, lalu rantai wajib Task 6 berjalan —
// validateImageInput → processPoster → putImage. Byte yang disimpan
// SELALU hasil processPoster (WebP), tidak ada jalur simpan mentah.

"use server";

import { getSessionEmail } from "../../../lib/auth.ts";
import { ensureSchema } from "../../../lib/db.ts";
import {
  deleteImage,
  organizerImageKey,
  processPoster,
  putImage,
  validateImageInput,
} from "../../../lib/storage.ts";

export type UploadImageResult = { url: string } | { error: string };

const IMAGE_KINDS = new Set(["poster", "logo", "photo"]);

export async function uploadImageAction(
  formData: FormData,
): Promise<UploadImageResult> {
  const email = await getSessionEmail();
  if (!email) return { error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };

  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih berkas gambar terlebih dahulu." };
  }
  if (!IMAGE_KINDS.has(kind)) {
    return { error: "Jenis gambar tidak dikenal." };
  }
  // ownerId WAJIB id/slug entitas dari pemanggil (disiplin Task 8):
  // nama tampilan mentah tidak boleh menjadi kunci berkas.
  if (!ownerId) {
    return { error: "Identitas pemilik gambar tidak ditemukan." };
  }

  const validation = validateImageInput({
    contentType: file.type,
    sizeBytes: file.size,
  });
  if (!validation.ok) return { error: validation.error };

  let processed: Buffer;
  try {
    processed = await processPoster(Buffer.from(await file.arrayBuffer()));
  } catch {
    return {
      error:
        "Berkas tidak dapat dibaca sebagai gambar. Gunakan JPG, PNG, atau WebP yang valid.",
    };
  }

  try {
    const key = organizerImageKey(
      kind as "poster" | "logo" | "photo",
      ownerId,
    );
    const { url } = await putImage(key, processed);
    return { url };
  } catch {
    return { error: "Gagal menyimpan gambar. Silakan coba lagi." };
  }
}

export async function deleteImageAction(
  url: string,
): Promise<{ ok: true } | { error: string }> {
  const email = await getSessionEmail();
  if (!email) return { error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  await ensureSchema();
  try {
    await deleteImage(url);
    return { ok: true };
  } catch {
    return { error: "Gagal menghapus gambar. Silakan coba lagi." };
  }
}
