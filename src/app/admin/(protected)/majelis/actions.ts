// Server actions Majelis (plan Task 8). Setiap action memeriksa sesi
// admin lebih dulu — tanpa sesi valid, pekerjaan ditolak sebelum
// menyentuh repository. Pola mengikuti actions Task 5/7 ("use server"
// per berkas, hasil berupa objek yang dapat ditindaklanjuti klien).

"use server";

import { revalidatePath } from "next/cache";
import { getSessionEmail } from "../../../../lib/auth.ts";
import {
  createMajelis,
  deleteMajelis,
  ensureSchema,
  getMajelisById,
  promoteManualOrganizer,
  updateMajelis,
  type MajelisInput,
} from "../../../../lib/db.ts";
import { deleteImage } from "../../../../lib/storage.ts";
import {
  validateMajelisForPublish,
  type MissingField,
} from "../../../../lib/validation.ts";

/** Nilai form dari klien: string apa adanya; kosong → null di server. */
export interface MajelisSaveInput {
  id: string | null;
  name: string;
  city: string;
  leader: string;
  logoUrl: string | null;
  photoUrl: string | null;
  baseAddress: string;
  baseDistrict: string;
  baseMapsUrl: string;
  description: string;
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  websiteUrl: string;
  contact: string;
}

export type SaveMajelisResult =
  | { ok: true; id: string; slug: string; updatedAt: string }
  | { ok: false; error: string };

export type PublishMajelisResult =
  | { ok: true }
  | { ok: false; error: string; missing?: MissingField[] };

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function revalidateMajelis(id?: string): void {
  revalidatePath("/admin/majelis");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/majelis/${id}`);
}

export async function saveMajelisAction(
  input: MajelisSaveInput,
): Promise<SaveMajelisResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();

  const data: Omit<MajelisInput, "status" | "createdBy"> = {
    // Draft boleh disimpan setengah jadi (spec §6.6); nama kosong
    // disimpan sebagai "(Tanpa nama)" agar tetap dapat dikenali di daftar.
    name: input.name.trim() === "" ? "(Tanpa nama)" : input.name.trim(),
    city: input.city.trim(),
    leader: blankToNull(input.leader),
    logoUrl: input.logoUrl,
    photoUrl: input.photoUrl,
    baseAddress: blankToNull(input.baseAddress),
    baseDistrict: blankToNull(input.baseDistrict),
    baseMapsUrl: blankToNull(input.baseMapsUrl),
    description: blankToNull(input.description),
    instagramUrl: blankToNull(input.instagramUrl),
    youtubeUrl: blankToNull(input.youtubeUrl),
    tiktokUrl: blankToNull(input.tiktokUrl),
    websiteUrl: blankToNull(input.websiteUrl),
    contact: blankToNull(input.contact),
  };

  try {
    if (input.id) {
      const existing = await getMajelisById(input.id);
      if (!existing) return { ok: false, error: "Majelis tidak ditemukan." };
      // Status TIDAK diubah oleh simpan — publish/unpublish punya aksi sendiri.
      const updated = await updateMajelis(input.id, data);
      if (!updated) return { ok: false, error: "Majelis tidak ditemukan." };
      revalidateMajelis(updated.id);
      return { ok: true, id: updated.id, slug: updated.slug, updatedAt: updated.updatedAt };
    }
    const created = await createMajelis({
      ...data,
      status: "draft",
      createdBy: email,
    });
    revalidateMajelis(created.id);
    return { ok: true, id: created.id, slug: created.slug, updatedAt: created.updatedAt };
  } catch {
    return { ok: false, error: "Gagal menyimpan majelis. Silakan coba lagi." };
  }
}

export async function publishMajelisAction(
  id: string,
): Promise<PublishMajelisResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getMajelisById(id);
  if (!existing) return { ok: false, error: "Majelis tidak ditemukan." };

  // Validasi publish ditegakkan di server juga (spec §6.6) — dialog di
  // klien bukan satu-satunya gerbang.
  const missing = validateMajelisForPublish(existing);
  if (missing.length > 0) {
    return {
      ok: false,
      error: "Masih ada field wajib yang belum lengkap.",
      missing,
    };
  }
  await updateMajelis(id, { status: "published" });
  revalidateMajelis(id);
  return { ok: true };
}

export async function unpublishMajelisAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getMajelisById(id);
  if (!existing) return { ok: false, error: "Majelis tidak ditemukan." };
  await updateMajelis(id, { status: "draft" });
  revalidateMajelis(id);
  return { ok: true };
}

export async function deleteMajelisAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getMajelisById(id);
  if (!existing) return { ok: false, error: "Majelis tidak ditemukan." };
  // Gambar dibersihkan lebih dulu agar tidak yatim setelah record hilang;
  // event/rutin TIDAK ikut terhapus — hubungannya dikosongkan repository.
  if (existing.logoUrl) await deleteImage(existing.logoUrl);
  if (existing.photoUrl) await deleteImage(existing.photoUrl);
  await deleteMajelis(id);
  revalidateMajelis();
  return { ok: true };
}

export async function promoteOrganizerAction(
  name: string,
  city: string,
): Promise<
  | { ok: true; linkedEvents: number; linkedRoutines: number; majelisName: string }
  | { ok: false; error: string }
> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  try {
    const result = await promoteManualOrganizer(name, city);
    revalidateMajelis(result.majelis.id);
    return {
      ok: true,
      linkedEvents: result.linkedEvents,
      linkedRoutines: result.linkedRoutines,
      majelisName: result.majelis.name,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mempromosikan penyelenggara. Silakan coba lagi.",
    };
  }
}
