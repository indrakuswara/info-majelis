// Server actions Jadwal Rutin + Pengecualian (plan Task 10). Setiap
// action memeriksa sesi admin lebih dulu — tanpa sesi valid, pekerjaan
// ditolak sebelum menyentuh repository. Pola mengikuti actions Event
// Task 9.
//
// Aturan yang ditegakkan di sini:
// - Draft selalu boleh disimpan tidak lengkap (spec §6.6). Repository
//   Task 4 mewajibkan jam mulai valid, jadi jam mulai kosong disimpan
//   sebagai penanda "00:00"; pola yang belum lengkap disimpan dengan
//   nilai penanda (weekday -1 / dayOfMonth 0) yang TIDAK lolos
//   validateRoutineForPublish — gerbang publish di server memetakan
//   penanda kembali sebagai field kurang, sehingga payload langsung
//   tidak dapat melewatinya.
// - Publish ditegakkan server-side atas record tersimpan (validate
//   RoutineForPublish Task 3), bukan hanya dialog.
// - Rutin yang SUDAH terbit tidak boleh disimpan menjadi tidak lengkap
//   (spec §14): simpan ditolak dengan pesan yang menyebut field
//   kurang, data lama tidak berubah.
// - Penyelenggara profil wajib majelis yang ada DAN sudah terbit
//   (gerbang server yang sama seperti Event).
// - Saat simpan, koordinat diekstrak best-effort dari link Maps manual
//   via parseMapsCoords (spec §13.4) — gagal parse tidak menggagalkan.
// - Pengecualian divalidasi repository Task 4: tanggal harus tanggal
//   kemunculan pola & tepat satu pengecualian per tanggal; pesan
//   error repository diteruskan apa adanya (sudah Bahasa Indonesia).

"use server";

import { revalidatePath } from "next/cache";
import { getSessionEmail } from "../../../../lib/auth.ts";
import {
  createRoutine,
  createRoutineException,
  deleteRoutine,
  deleteRoutineException,
  ensureSchema,
  getMajelisById,
  getRoutineById,
  setRoutineActive,
  updateRoutine,
  type RoutineInput,
} from "../../../../lib/db.ts";
import {
  buildPatternFromParts,
  type PatternFormParts,
} from "../../../../components/admin/routine-pattern.ts";
import type {
  Audience,
  Category,
  ExceptionKind,
} from "../../../../lib/domain.ts";
import { parseMapsCoords } from "../../../../lib/share.ts";
import { deleteImage } from "../../../../lib/storage.ts";
import {
  validateRoutineForPublish,
  type MissingField,
} from "../../../../lib/validation.ts";

/** Nilai form dari klien: string apa adanya; kosong → null di server. */
export interface RoutineSaveInput extends PatternFormParts {
  id: string | null;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  /** "YYYY-MM-DD" atau "" (tanpa batas). */
  effectiveFrom: string;
  effectiveTo: string;
  specialNote: string;
  venueName: string;
  address: string;
  city: string;
  district: string;
  mapsUrl: string;
  description: string;
  posterUrl: string | null;
  organizerMajelisId: string | null;
  organizerNameManual: string;
  /** Penceramah sebagai teks multi-baris (satu nama per baris). */
  speakersText: string;
  audience: string;
  liveStreamUrl: string;
  contact: string;
  extraInfo: string;
  libraryUrl: string;
  sourceInfo: string;
}

export type SaveRoutineResult =
  | { ok: true; id: string; slug: string; updatedAt: string }
  | { ok: false; error: string; missing?: MissingField[] };

export type PublishRoutineResult =
  | { ok: true }
  | { ok: false; error: string; missing?: MissingField[] };

export type SimpleResult = { ok: true } | { ok: false; error: string };

const AUDIENCES: Audience[] = ["umum", "ikhwan", "akhwat"];
const PLACEHOLDER_TIME = "00:00";

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function revalidateRoutines(id?: string): void {
  revalidatePath("/admin/routines");
  revalidatePath("/admin");
  if (id) {
    revalidatePath(`/admin/routines/${id}/edit`);
    revalidatePath(`/admin/routines/${id}/preview`);
  }
}

/** Validasi publish atas NILAI FORM mentah (sebelum penanda disimpan). */
function missingFromInput(input: RoutineSaveInput): MissingField[] {
  return validateRoutineForPublish({
    title: input.title,
    category: input.category as Category,
    pattern: buildPatternFromParts(input),
    startTime: input.startTime,
    venueName: input.venueName,
    address: input.address,
    city: input.city,
    district: input.district,
  });
}

/**
 * Validasi publish atas RECORD TERSIMPAN: jam penanda "00:00" dipetakan
 * kembali menjadi kosong agar gerbang server tidak dapat dilewati
 * nilai penanda. (Konsekuensi yang disadari: jam mulai tepat 00:00
 * diperlakukan sebagai penanda, sama seperti pola Event Task 9.)
 * Pola penanda (weekday -1 / dayOfMonth 0) memang sudah tidak lolos
 * validateRoutineForPublish apa adanya.
 */
function missingFromRecord(
  record: Parameters<typeof validateRoutineForPublish>[0],
): MissingField[] {
  return validateRoutineForPublish({
    ...record,
    startTime: record.startTime === PLACEHOLDER_TIME ? "" : record.startTime,
  });
}

export async function saveRoutineAction(
  input: RoutineSaveInput,
): Promise<SaveRoutineResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();

  // Penyelenggara profil harus merujuk majelis yang ada DAN sudah
  // terbit; picker klien hanya menawarkan profil terbit, ini penjaga
  // server-nya untuk payload yang dikirim langsung.
  if (input.organizerMajelisId) {
    const majelis = await getMajelisById(input.organizerMajelisId);
    if (!majelis) {
      return { ok: false, error: "Profil majelis penyelenggara tidak ditemukan." };
    }
    if (majelis.status !== "published") {
      return {
        ok: false,
        error:
          "Profil majelis penyelenggara belum terbit. Pilih majelis yang sudah terbit, atau kosongkan profil dan isi nama penyelenggara secara manual.",
      };
    }
  }

  const mapsUrl = blankToNull(input.mapsUrl);
  const coords = mapsUrl ? parseMapsCoords(mapsUrl) : null;

  const data: Omit<RoutineInput, "status" | "createdBy" | "isActive"> = {
    title: input.title.trim(),
    category: input.category as Category,
    pattern: buildPatternFromParts(input),
    startTime:
      input.startTime.trim() === "" ? PLACEHOLDER_TIME : input.startTime.trim(),
    endTime: blankToNull(input.endTime),
    effectiveFrom: blankToNull(input.effectiveFrom),
    effectiveTo: blankToNull(input.effectiveTo),
    specialNote: blankToNull(input.specialNote),
    venueName: input.venueName.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    district: input.district.trim(),
    mapsUrl,
    // Koordinat hasil ekstraksi diam-diam (spec §13.4); tanpa link
    // manual atau gagal parse → null, bukan error.
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    description: blankToNull(input.description),
    posterUrl: input.posterUrl,
    organizerMajelisId: input.organizerMajelisId,
    organizerNameManual: input.organizerMajelisId
      ? null
      : blankToNull(input.organizerNameManual),
    speakers: input.speakersText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== ""),
    audience: AUDIENCES.includes(input.audience as Audience)
      ? (input.audience as Audience)
      : "umum",
    liveStreamUrl: blankToNull(input.liveStreamUrl),
    contact: blankToNull(input.contact),
    extraInfo: blankToNull(input.extraInfo),
    libraryUrl: blankToNull(input.libraryUrl),
    sourceInfo: blankToNull(input.sourceInfo),
  };

  try {
    if (input.id) {
      const existing = await getRoutineById(input.id);
      if (!existing) return { ok: false, error: "Jadwal rutin tidak ditemukan." };
      // Penjaga §14: rutin terbit wajib tetap lengkap — nilai FORM
      // mentah yang divalidasi, supaya penanda tidak menyembunyikan
      // field yang dikosongkan admin.
      if (existing.status === "published") {
        const missing = missingFromInput(input);
        if (missing.length > 0) {
          return {
            ok: false,
            error: `Jadwal rutin ini sudah terbit sehingga harus tetap lengkap. Simpan ditolak — field yang kurang: ${missing
              .map((m) => m.label)
              .join(", ")}. Turunkan status ke draft terlebih dahulu bila memang ingin mengosongkannya.`,
            missing,
          };
        }
      }
      // Status & penanda aktif TIDAK diubah oleh simpan — keduanya
      // punya aksi sendiri.
      const updated = await updateRoutine(input.id, data);
      if (!updated) return { ok: false, error: "Jadwal rutin tidak ditemukan." };
      revalidateRoutines(updated.id);
      return { ok: true, id: updated.id, slug: updated.slug, updatedAt: updated.updatedAt };
    }
    const created = await createRoutine({
      ...data,
      status: "draft",
      isActive: true,
      createdBy: email,
    });
    revalidateRoutines(created.id);
    return { ok: true, id: created.id, slug: created.slug, updatedAt: created.updatedAt };
  } catch {
    return { ok: false, error: "Gagal menyimpan jadwal rutin. Silakan coba lagi." };
  }
}

export async function publishRoutineAction(
  id: string,
): Promise<PublishRoutineResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getRoutineById(id);
  if (!existing) return { ok: false, error: "Jadwal rutin tidak ditemukan." };

  // Gerbang yang SAMA seperti dialog klien, ditegakkan di server atas
  // record tersimpan (spec §6.6) — pemanggilan langsung tetap ditolak.
  const missing = missingFromRecord(existing);
  if (missing.length > 0) {
    return {
      ok: false,
      error: "Masih ada field wajib yang belum lengkap.",
      missing,
    };
  }
  await updateRoutine(id, { status: "published" });
  revalidateRoutines(id);
  return { ok: true };
}

export async function unpublishRoutineAction(id: string): Promise<SimpleResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getRoutineById(id);
  if (!existing) return { ok: false, error: "Jadwal rutin tidak ditemukan." };
  await updateRoutine(id, { status: "draft" });
  revalidateRoutines(id);
  return { ok: true };
}

export async function deleteRoutineAction(id: string): Promise<SimpleResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getRoutineById(id);
  if (!existing) return { ok: false, error: "Jadwal rutin tidak ditemukan." };
  // Poster dibersihkan dari storage lebih dulu, lalu record dihapus
  // (repository ikut menghapus pengecualiannya) — urutan plan Task 9
  // agar tidak ada gambar yatim yang tak terjangkau.
  if (existing.posterUrl) await deleteImage(existing.posterUrl);
  await deleteRoutine(id);
  revalidateRoutines();
  return { ok: true };
}

export async function setRoutineActiveAction(
  id: string,
  active: boolean,
): Promise<SimpleResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getRoutineById(id);
  if (!existing) return { ok: false, error: "Jadwal rutin tidak ditemukan." };
  await setRoutineActive(id, active);
  revalidateRoutines(id);
  return { ok: true };
}

// --- Pengecualian -------------------------------------------------------------

export interface ExceptionSaveInput {
  routineId: string;
  kind: ExceptionKind;
  /** "YYYY-MM-DD" — harus tanggal kemunculan pola induk. */
  date: string;
  note: string;
  /** Override khusus edisi spesial; string kosong = pakai nilai induk. */
  overrideVenueName: string;
  overrideAddress: string;
  overrideStartTime: string;
  overrideDescription: string;
}

export async function saveExceptionAction(
  input: ExceptionSaveInput,
): Promise<SimpleResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const routine = await getRoutineById(input.routineId);
  if (!routine) return { ok: false, error: "Jadwal rutin tidak ditemukan." };

  const isSpecial = input.kind === "edisi-spesial";
  try {
    // Repository menegakkan: tanggal hasil pola & satu pengecualian
    // per tanggal; pesan errornya sudah Bahasa Indonesia dan layak
    // tampil apa adanya.
    await createRoutineException({
      routineId: input.routineId,
      date: input.date.trim(),
      kind: input.kind,
      note: blankToNull(input.note),
      overrideVenueName: isSpecial ? blankToNull(input.overrideVenueName) : null,
      overrideAddress: isSpecial ? blankToNull(input.overrideAddress) : null,
      overrideStartTime: isSpecial ? blankToNull(input.overrideStartTime) : null,
      overrideDescription: isSpecial
        ? blankToNull(input.overrideDescription)
        : null,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal menyimpan pengecualian. Silakan coba lagi.",
    };
  }
  revalidateRoutines(input.routineId);
  return { ok: true };
}

export async function deleteExceptionAction(
  exceptionId: string,
  routineId: string,
): Promise<SimpleResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  await deleteRoutineException(exceptionId);
  revalidateRoutines(routineId);
  return { ok: true };
}
