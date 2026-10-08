// Server actions Event (plan Task 9). Setiap action memeriksa sesi
// admin lebih dulu — tanpa sesi valid, pekerjaan ditolak sebelum
// menyentuh repository. Pola mengikuti actions Majelis Task 8.
//
// Aturan yang ditegakkan di sini:
// - Draft selalu boleh disimpan tidak lengkap (spec §6.6). Repository
//   Task 4 mewajibkan tanggal/jam valid, jadi tanggal mulai kosong
//   disimpan sebagai penanda EVENT_DRAFT_PLACEHOLDER_DATE dan jam mulai
//   kosong sebagai "00:00"; gerbang publish memetakannya kembali
//   sebagai field kurang, dan slug diregenerasi begitu tanggal asli
//   pertama kali tersimpan (slug event = slugify judul + tanggal,
//   dihitung repository — jalur slug tidak dibuat sendiri di sini).
// - Publish ditegakkan server-side atas record tersimpan (validate
//   EventForPublish Task 3 + pemetaan penanda), bukan hanya dialog.
// - Event yang SUDAH terbit tidak boleh disimpan menjadi tidak lengkap
//   (spec §14): simpan ditolak dengan pesan yang menyebut field kurang,
//   data lama tidak berubah, status tidak berubah diam-diam.
// - Saat simpan, koordinat diekstrak best-effort dari link Maps manual
//   via parseMapsCoords (spec §13.4) — gagal parse tidak menggagalkan.

"use server";

import { revalidatePath } from "next/cache";
import { getSessionEmail } from "../../../../lib/auth.ts";
import {
  createEvent,
  deleteEvent,
  ensureSchema,
  getEventById,
  getMajelisById,
  updateEvent,
  type EventInput,
} from "../../../../lib/db.ts";
import type { Audience, Category } from "../../../../lib/domain.ts";
import { parseMapsCoords } from "../../../../lib/share.ts";
import { deleteImage } from "../../../../lib/storage.ts";
import { EVENT_DRAFT_PLACEHOLDER_DATE } from "../../../../lib/utils.ts";
import {
  validateEventForPublish,
  type MissingField,
} from "../../../../lib/validation.ts";

/** Nilai form dari klien: string apa adanya; kosong → null di server. */
export interface EventSaveInput {
  id: string | null;
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
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

export type SaveEventResult =
  | { ok: true; id: string; slug: string; updatedAt: string }
  | { ok: false; error: string; missing?: MissingField[] };

export type PublishEventResult =
  | { ok: true }
  | { ok: false; error: string; missing?: MissingField[] };

const AUDIENCES: Audience[] = ["umum", "ikhwan", "akhwat"];
const PLACEHOLDER_TIME = "00:00";

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function revalidateEvents(id?: string): void {
  revalidatePath("/admin/events");
  revalidatePath("/admin");
  if (id) {
    revalidatePath(`/admin/events/${id}`);
    revalidatePath(`/admin/events/${id}/preview`);
  }
}

/** Validasi publish atas NILAI FORM mentah (sebelum penanda disimpan). */
function missingFromInput(input: EventSaveInput): MissingField[] {
  return validateEventForPublish({
    title: input.title,
    category: input.category as Category,
    startDate: input.startDate,
    startTime: input.startTime,
    venueName: input.venueName,
    address: input.address,
    city: input.city,
    district: input.district,
  });
}

/**
 * Validasi publish atas RECORD TERSIMPAN: tanggal penanda dipetakan
 * kembali menjadi kosong (dan jam penanda "00:00" yang menyertai
 * tanggal penanda ikut dianggap kosong) agar gerbang server tidak dapat
 * dilewati nilai penanda.
 */
function missingFromRecord(
  record: Parameters<typeof validateEventForPublish>[0],
): MissingField[] {
  const isPlaceholder = record.startDate === EVENT_DRAFT_PLACEHOLDER_DATE;
  return validateEventForPublish({
    ...record,
    startDate: isPlaceholder ? "" : record.startDate,
    startTime:
      isPlaceholder && record.startTime === PLACEHOLDER_TIME
        ? ""
        : record.startTime,
  });
}

export async function saveEventAction(
  input: EventSaveInput,
): Promise<SaveEventResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();

  // Penyelenggara profil harus merujuk majelis yang ada; picker klien
  // hanya menawarkan profil terbit, ini penjaga server-nya.
  if (input.organizerMajelisId) {
    const majelis = await getMajelisById(input.organizerMajelisId);
    if (!majelis) {
      return { ok: false, error: "Profil majelis penyelenggara tidak ditemukan." };
    }
  }

  const mapsUrl = blankToNull(input.mapsUrl);
  const coords = mapsUrl ? parseMapsCoords(mapsUrl) : null;

  const data: Omit<EventInput, "status" | "createdBy"> = {
    title: input.title.trim(),
    category: input.category as Category,
    startDate:
      input.startDate.trim() === ""
        ? EVENT_DRAFT_PLACEHOLDER_DATE
        : input.startDate.trim(),
    endDate: blankToNull(input.endDate),
    startTime:
      input.startTime.trim() === "" ? PLACEHOLDER_TIME : input.startTime.trim(),
    endTime: blankToNull(input.endTime),
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
      const existing = await getEventById(input.id);
      if (!existing) return { ok: false, error: "Event tidak ditemukan." };
      // Penjaga §14: event terbit wajib tetap lengkap — nilai FORM
      // mentah yang divalidasi, supaya penanda tidak menyembunyikan
      // field yang dikosongkan admin.
      if (existing.status === "published") {
        const missing = missingFromInput(input);
        if (missing.length > 0) {
          return {
            ok: false,
            error: `Event ini sudah terbit sehingga harus tetap lengkap. Simpan ditolak — field yang kurang: ${missing
              .map((m) => m.label)
              .join(", ")}. Turunkan status ke draft terlebih dahulu bila memang ingin mengosongkannya.`,
            missing,
          };
        }
      }
      // Status TIDAK diubah oleh simpan — publish/unpublish punya aksi sendiri.
      let updated = await updateEvent(input.id, data);
      if (!updated) return { ok: false, error: "Event tidak ditemukan." };
      // Slug lahir dari tanggal penanda? Begitu tanggal asli pertama
      // kali tersimpan pada draft, regenerasi slug lewat repository
      // (slugify judul + tanggal mulai) agar URL publik benar.
      if (
        existing.status === "draft" &&
        existing.startDate === EVENT_DRAFT_PLACEHOLDER_DATE &&
        data.startDate !== EVENT_DRAFT_PLACEHOLDER_DATE &&
        updated.slug.endsWith(`-${EVENT_DRAFT_PLACEHOLDER_DATE}`)
      ) {
        const regenerated = await updateEvent(input.id, {
          slug: `${data.title}-${data.startDate}`,
        });
        if (regenerated) updated = regenerated;
      }
      revalidateEvents(updated.id);
      return { ok: true, id: updated.id, slug: updated.slug, updatedAt: updated.updatedAt };
    }
    const created = await createEvent({
      ...data,
      status: "draft",
      createdBy: email,
    });
    revalidateEvents(created.id);
    return { ok: true, id: created.id, slug: created.slug, updatedAt: created.updatedAt };
  } catch {
    return { ok: false, error: "Gagal menyimpan event. Silakan coba lagi." };
  }
}

export async function publishEventAction(
  id: string,
): Promise<PublishEventResult> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getEventById(id);
  if (!existing) return { ok: false, error: "Event tidak ditemukan." };

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
  await updateEvent(id, { status: "published" });
  revalidateEvents(id);
  return { ok: true };
}

export async function unpublishEventAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getEventById(id);
  if (!existing) return { ok: false, error: "Event tidak ditemukan." };
  await updateEvent(id, { status: "draft" });
  revalidateEvents(id);
  return { ok: true };
}

export async function deleteEventAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await getSessionEmail();
  if (!email) {
    return { ok: false, error: "Sesi admin tidak ditemukan. Silakan masuk kembali." };
  }
  await ensureSchema();
  const existing = await getEventById(id);
  if (!existing) return { ok: false, error: "Event tidak ditemukan." };
  // Poster dibersihkan dari storage lebih dulu, lalu record dihapus —
  // urutan plan Task 9 agar tidak ada gambar yatim yang tak terjangkau
  // setelah record hilang.
  if (existing.posterUrl) await deleteImage(existing.posterUrl);
  await deleteEvent(id);
  revalidateEvents();
  return { ok: true };
}
