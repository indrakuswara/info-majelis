"use client";

// Form Event sekali jalan (plan Task 9; field persis spec §6.2 — TANPA
// Link Pendaftaran & Biaya, spec §5.3). Pola interaksi spec §8 meniru
// MajelisForm Task 8: simpan via ActionButton async, indikator belum
// disimpan + "Terakhir disimpan", publish lewat PublishDialog dengan
// daftar kurang yang dapat diklik untuk lompat/fokus ke field,
// unpublish lewat ConfirmDialog, hapus lewat DeleteButton, penjaga
// §14 ditegakkan server di saveEventAction. Disiplin gambar sama:
// ImageUpload tidak menghapus berkas; berkas poster lama dihapus form
// ini SETELAH simpan berhasil; ownerId selalu id entitas (UUID lebih
// dulu untuk event baru). Pratinjau jamaah dirender langsung dari nilai
// form saat ini di seksi bawah form.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  deleteEventAction,
  publishEventAction,
  saveEventAction,
  unpublishEventAction,
  type EventSaveInput,
} from "../../app/admin/(protected)/events/actions.ts";
import { deleteImageAction } from "../../app/admin/(protected)/upload-action.ts";
import { CATEGORIES, REGIONS } from "../../lib/constants.ts";
import type { Audience, Category, EventRecord } from "../../lib/domain.ts";
import { EVENT_DRAFT_PLACEHOLDER_DATE } from "../../lib/utils.ts";
import {
  validateEventForPublish,
  type MissingField,
} from "../../lib/validation.ts";
import { ActionButton } from "./ActionButton.tsx";
import { useUnsavedChangesGuard } from "./AdminShell.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { DeleteButton } from "./DeleteButton.tsx";
import { EventPreview } from "./EventPreview.tsx";
import { ImageUpload } from "./ImageUpload.tsx";
import {
  OrganizerPicker,
  type OrganizerOption,
} from "./OrganizerPicker.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { useToast } from "./Toast.tsx";

interface FormFields {
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
  speakersText: string;
  audience: Audience;
  liveStreamUrl: string;
  contact: string;
  extraInfo: string;
  libraryUrl: string;
  sourceInfo: string;
}

function fieldsFromRecord(record: EventRecord | null): FormFields {
  return {
    title: record?.title ?? "",
    category: record?.category ?? "",
    // Tanggal penanda draft (repository mewajibkan tanggal valid)
    // ditampilkan kembali sebagai kosong di form.
    startDate:
      record && record.startDate !== EVENT_DRAFT_PLACEHOLDER_DATE
        ? record.startDate
        : "",
    endDate: record?.endDate ?? "",
    // Jam penanda "00:00" yang menyertai tanggal penanda juga
    // ditampilkan kembali sebagai kosong (cermin gerbang server).
    startTime:
      record &&
      record.startDate === EVENT_DRAFT_PLACEHOLDER_DATE &&
      record.startTime === "00:00"
        ? ""
        : (record?.startTime ?? ""),
    endTime: record?.endTime ?? "",
    venueName: record?.venueName ?? "",
    address: record?.address ?? "",
    city: record?.city ?? "",
    district: record?.district ?? "",
    mapsUrl: record?.mapsUrl ?? "",
    description: record?.description ?? "",
    posterUrl: record?.posterUrl ?? null,
    organizerMajelisId: record?.organizerMajelisId ?? null,
    organizerNameManual: record?.organizerNameManual ?? "",
    speakersText: record?.speakers.join("\n") ?? "",
    audience: record?.audience ?? "umum",
    liveStreamUrl: record?.liveStreamUrl ?? "",
    contact: record?.contact ?? "",
    extraInfo: record?.extraInfo ?? "",
    libraryUrl: record?.libraryUrl ?? "",
    sourceInfo: record?.sourceInfo ?? "",
  };
}

const inputClass =
  "rounded-md border border-neutral-300 px-3 py-2 font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export interface EventFormProps {
  initial: EventRecord | null;
  /** Profil majelis TERBIT yang dapat dipilih sebagai penyelenggara. */
  organizerOptions: OrganizerOption[];
  /** Auto-saran kecamatan per kota dari listKnownDistricts (Task 4). */
  districtSuggestionsByCity: Record<string, string[]>;
}

export function EventForm({
  initial,
  organizerOptions,
  districtSuggestionsByCity,
}: EventFormProps) {
  const router = useRouter();
  const { show } = useToast();

  const [recordId, setRecordId] = useState<string | null>(initial?.id ?? null);
  const [slug, setSlug] = useState<string | null>(initial?.slug ?? null);
  const [status, setStatus] = useState<EventRecord["status"]>(
    initial?.status ?? "draft",
  );
  const [fields, setFields] = useState<FormFields>(() =>
    fieldsFromRecord(initial),
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    JSON.stringify(fieldsFromRecord(initial)),
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initial?.updatedAt ?? null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const publishBusyRef = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ownerId ImageUpload SELALU id entitas (pola MajelisForm): untuk
  // event baru hasilkan UUID lebih dulu agar key berkas tidak
  // bertabrakan dan tidak memakai judul sebagai kunci.
  const [newOwnerId] = useState<string>(() => crypto.randomUUID());
  const ownerId = recordId ?? newOwnerId;

  // Poster yang TERCATAT tersimpan terakhir; berkas lama baru dihapus
  // setelah simpan berhasil (lihat persist()).
  const savedPosterRef = useRef<string | null>(initial?.posterUrl ?? null);

  const dirty = useMemo(
    () => JSON.stringify(fields) !== savedSnapshot,
    [fields, savedSnapshot],
  );
  useUnsavedChangesGuard(dirty);

  const set = <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const missing: MissingField[] = useMemo(
    () =>
      validateEventForPublish({
        title: fields.title,
        category: fields.category as Category,
        startDate: fields.startDate,
        startTime: fields.startTime,
        venueName: fields.venueName,
        address: fields.address,
        city: fields.city,
        district: fields.district,
      }),
    [
      fields.title,
      fields.category,
      fields.startDate,
      fields.startTime,
      fields.venueName,
      fields.address,
      fields.city,
      fields.district,
    ],
  );

  const jumpToField = (field: string) => {
    setPublishOpen(false);
    window.setTimeout(() => {
      const element = document.getElementById(field);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus();
    }, 50);
  };

  const districtSuggestions = districtSuggestionsByCity[fields.city] ?? [];

  const previewOrganizerName = fields.organizerMajelisId
    ? (organizerOptions.find((o) => o.id === fields.organizerMajelisId)
        ?.name ?? null)
    : fields.organizerNameManual.trim() === ""
      ? null
      : fields.organizerNameManual.trim();

  /** Simpan form; kembalikan id record atau null bila gagal. */
  const persist = async (): Promise<string | null> => {
    const input: EventSaveInput = {
      id: recordId,
      title: fields.title,
      category: fields.category,
      startDate: fields.startDate,
      endDate: fields.endDate,
      startTime: fields.startTime,
      endTime: fields.endTime,
      venueName: fields.venueName,
      address: fields.address,
      city: fields.city,
      district: fields.district,
      mapsUrl: fields.mapsUrl,
      description: fields.description,
      posterUrl: fields.posterUrl,
      organizerMajelisId: fields.organizerMajelisId,
      organizerNameManual: fields.organizerNameManual,
      speakersText: fields.speakersText,
      audience: fields.audience,
      liveStreamUrl: fields.liveStreamUrl,
      contact: fields.contact,
      extraInfo: fields.extraInfo,
      libraryUrl: fields.libraryUrl,
      sourceInfo: fields.sourceInfo,
    };
    const result = await saveEventAction(input);
    if (!result.ok) {
      setSaveError(result.error);
      show(result.error, "error");
      return null;
    }
    setSaveError(null);
    setRecordId(result.id);
    setSlug(result.slug);
    setLastSavedAt(result.updatedAt);
    setSavedSnapshot(JSON.stringify(fields));
    // Simpan BERHASIL — aman menghapus berkas poster lama yang sudah
    // tidak dirujuk record.
    const previousPoster = savedPosterRef.current;
    savedPosterRef.current = fields.posterUrl;
    if (previousPoster && previousPoster !== fields.posterUrl) {
      await deleteImageAction(previousPoster);
    }
    return result.id;
  };

  const handleSave = async () => {
    const wasNew = recordId === null;
    const id = await persist();
    if (!id) return;
    show("Draft tersimpan.");
    if (wasNew) {
      router.replace(`/admin/events/${id}`);
    } else {
      router.refresh();
    }
  };

  const handleConfirmPublish = async () => {
    if (publishBusyRef.current || missing.length > 0) return;
    publishBusyRef.current = true;
    setPublishBusy(true);
    try {
      let id = recordId;
      if (dirty || id === null) {
        id = await persist();
        if (!id) {
          setPublishOpen(false);
          return;
        }
      }
      const result = await publishEventAction(id);
      if (!result.ok) {
        show(result.error, "error");
        setPublishOpen(false);
        return;
      }
      setStatus("published");
      setPublishOpen(false);
      show(`Event "${fields.title.trim()}" berhasil diterbitkan.`);
      router.replace(`/admin/events/${id}`);
      router.refresh();
    } finally {
      publishBusyRef.current = false;
      setPublishBusy(false);
    }
  };

  const handleConfirmUnpublish = async () => {
    if (!recordId || publishBusyRef.current) return;
    publishBusyRef.current = true;
    setPublishBusy(true);
    try {
      const result = await unpublishEventAction(recordId);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      setStatus("draft");
      setUnpublishOpen(false);
      show(`Event "${fields.title.trim()}" tidak lagi tampil ke publik.`);
      router.refresh();
    } finally {
      publishBusyRef.current = false;
      setPublishBusy(false);
    }
  };

  const displayTitle =
    fields.title.trim() === "" ? "(Tanpa judul)" : fields.title.trim();
  const savedTimeLabel = lastSavedAt
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(lastSavedAt))
    : null;

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        {dirty ? (
          <span className="text-sm font-medium text-amber-800">
            ⚠ Ada perubahan belum disimpan
          </span>
        ) : savedTimeLabel ? (
          <span className="text-sm text-neutral-500">
            Terakhir disimpan pukul {savedTimeLabel} WIB
          </span>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Judul event <span className="text-red-700">*</span>
          <input
            id="title"
            type="text"
            value={fields.title}
            onChange={(event) => set("title", event.target.value)}
            className={inputClass}
            placeholder="cth. Maulid Akbar & Santunan Anak Yatim"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Kategori <span className="text-red-700">*</span>
          <select
            id="category"
            value={fields.category}
            onChange={(event) => set("category", event.target.value)}
            className={inputClass}
          >
            <option value="">— Pilih kategori —</option>
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Untuk siapa
          <select
            value={fields.audience}
            onChange={(event) =>
              set("audience", event.target.value as Audience)
            }
            className={inputClass}
          >
            <option value="umum">Umum</option>
            <option value="ikhwan">Ikhwan</option>
            <option value="akhwat">Akhwat</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tanggal mulai <span className="text-red-700">*</span>
          <input
            id="startDate"
            type="date"
            value={fields.startDate}
            onChange={(event) => set("startDate", event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tanggal selesai
          <input
            type="date"
            value={fields.endDate}
            onChange={(event) => set("endDate", event.target.value)}
            className={inputClass}
          />
          <span className="text-xs font-normal text-neutral-500">
            Hanya untuk event multi-hari. Kosongkan bila satu hari.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Jam mulai <span className="text-red-700">*</span>
          <input
            id="startTime"
            type="time"
            value={fields.startTime}
            onChange={(event) => set("startTime", event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Jam selesai
          <input
            type="time"
            value={fields.endTime}
            onChange={(event) => set("endTime", event.target.value)}
            className={inputClass}
          />
          <span className="text-xs font-normal text-neutral-500">
            Boleh kosong (&quot;s/d selesai&quot;). Bila lebih kecil dari
            jam mulai, dianggap selesai keesokan harinya.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Nama tempat <span className="text-red-700">*</span>
          <input
            id="venueName"
            type="text"
            value={fields.venueName}
            onChange={(event) => set("venueName", event.target.value)}
            className={inputClass}
            placeholder="cth. Masjid Agung Al-Azhar"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Kota/Kabupaten <span className="text-red-700">*</span>
          <select
            id="city"
            value={fields.city}
            onChange={(event) => set("city", event.target.value)}
            className={inputClass}
          >
            <option value="">— Pilih kota/kabupaten —</option>
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Alamat lengkap <span className="text-red-700">*</span>
          <input
            id="address"
            type="text"
            value={fields.address}
            onChange={(event) => set("address", event.target.value)}
            className={inputClass}
            placeholder="cth. Jl. Sisingamangaraja No. 1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Kecamatan <span className="text-red-700">*</span>
          <input
            id="district"
            type="text"
            list="event-district-suggestions"
            value={fields.district}
            onChange={(event) => set("district", event.target.value)}
            className={inputClass}
            placeholder="cth. Bekasi Timur"
          />
          <datalist id="event-district-suggestions">
            {districtSuggestions.map((district) => (
              <option key={district} value={district} />
            ))}
          </datalist>
          <span className="text-xs font-normal text-neutral-500">
            Saran mengikuti ejaan kecamatan yang sudah pernah dipakai di
            kota terpilih, agar filter publik konsisten.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Link Google Maps manual
          <input
            type="url"
            value={fields.mapsUrl}
            onChange={(event) => set("mapsUrl", event.target.value)}
            className={inputClass}
            placeholder="https://maps.google.com/…"
          />
          <span className="text-xs font-normal text-neutral-500">
            Boleh kosong — link rute dibuat dari nama tempat + alamat.
            Koordinat pada link akan diekstrak otomatis saat disimpan.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Deskripsi
          <textarea
            value={fields.description}
            onChange={(event) => set("description", event.target.value)}
            rows={4}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Penceramah
          <textarea
            value={fields.speakersText}
            onChange={(event) => set("speakersText", event.target.value)}
            rows={3}
            className={inputClass}
            placeholder={"Satu nama per baris, cth.:\nHabib Contoh\nKH. Contoh"}
          />
        </label>
      </div>

      <ImageUpload
        label="Poster event"
        value={fields.posterUrl}
        kind="poster"
        ownerId={ownerId}
        onChange={(url) => set("posterUrl", url)}
      />

      <OrganizerPicker
        majelisId={fields.organizerMajelisId}
        manualName={fields.organizerNameManual}
        options={organizerOptions}
        onChange={(value) => {
          set("organizerMajelisId", value.majelisId);
          set("organizerNameManual", value.manualName);
        }}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">Tautan & kontak</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Link live streaming
            <input
              type="url"
              value={fields.liveStreamUrl}
              onChange={(event) => set("liveStreamUrl", event.target.value)}
              className={inputClass}
              placeholder="https://youtube.com/…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Link bacaan di Perpustakaan
            <input
              type="url"
              value={fields.libraryUrl}
              onChange={(event) => set("libraryUrl", event.target.value)}
              className={inputClass}
              placeholder="https://perpustakaan-shalawat.vercel.app/…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Kontak panitia
            <input
              type="text"
              value={fields.contact}
              onChange={(event) => set("contact", event.target.value)}
              className={inputClass}
              placeholder="cth. WhatsApp 08xx-xxxx-xxxx (panitia)"
            />
            <span className="text-xs font-normal text-amber-800">
              Pengingat: kontak ini akan tampil ke publik di halaman
              detail event.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Info tambahan
            <textarea
              value={fields.extraInfo}
              onChange={(event) => set("extraInfo", event.target.value)}
              rows={3}
              className={inputClass}
              placeholder="cth. Parkir, akses khusus, anjuran berpakaian, info pendaftaran bila ada…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Sumber info
            <input
              type="text"
              value={fields.sourceInfo}
              onChange={(event) => set("sourceInfo", event.target.value)}
              className={inputClass}
              placeholder="cth. Poster resmi panitia / grup WhatsApp majelis"
            />
            <span className="text-xs font-normal text-neutral-500">
              Internal admin (jejak verifikasi) — tidak pernah tampil ke
              publik.
            </span>
          </label>
        </div>
      </fieldset>

      <section
        aria-label="Pratinjau tampilan jamaah"
        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Pratinjau tampilan jamaah</h2>
          <button
            type="button"
            onClick={() => setPreviewOpen((open) => !open)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
          >
            {previewOpen ? "Sembunyikan pratinjau" : "Tampilkan pratinjau"}
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Render kartu & detail versi publik dari isi form saat ini
          (belum tentu tersimpan). Tanpa poster, tampil fallback design
          berwarna kategori.
        </p>
        {previewOpen && (
          <div className="mt-4">
            <EventPreview
              data={{
                title: fields.title,
                category: fields.category as Category | "",
                startDate: fields.startDate,
                endDate: fields.endDate === "" ? null : fields.endDate,
                startTime: fields.startTime,
                endTime: fields.endTime === "" ? null : fields.endTime,
                venueName: fields.venueName,
                address: fields.address,
                city: fields.city,
                district: fields.district,
                mapsUrl: fields.mapsUrl === "" ? null : fields.mapsUrl,
                posterUrl: fields.posterUrl,
                organizerName: previewOrganizerName,
                speakers: fields.speakersText
                  .split("\n")
                  .map((line) => line.trim())
                  .filter((line) => line !== ""),
                audience: fields.audience,
                liveStreamUrl:
                  fields.liveStreamUrl === "" ? null : fields.liveStreamUrl,
                contact: fields.contact === "" ? null : fields.contact,
                extraInfo: fields.extraInfo === "" ? null : fields.extraInfo,
                libraryUrl: fields.libraryUrl === "" ? null : fields.libraryUrl,
                description:
                  fields.description === "" ? null : fields.description,
              }}
            />
          </div>
        )}
      </section>

      {saveError && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          {saveError} Isi form tidak hilang — silakan perbaiki lalu simpan
          lagi.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-5">
        <ActionButton
          type="button"
          onClick={handleSave}
          pendingLabel="Menyimpan…"
          className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          {status === "published" ? "Simpan Perubahan" : "Simpan Draft"}
        </ActionButton>

        {status === "published" ? (
          <button
            type="button"
            onClick={() => setUnpublishOpen(true)}
            className="rounded-md border border-neutral-300 px-4 py-2 font-semibold hover:bg-neutral-100"
          >
            Batalkan Terbit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="rounded-md border border-emerald-700 px-4 py-2 font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Terbitkan
          </button>
        )}

        {recordId && (
          <Link
            href={`/admin/events/${recordId}/preview`}
            className="text-sm font-medium text-emerald-800 underline"
          >
            Pratinjau halaman penuh
          </Link>
        )}
        {status === "published" && slug && (
          <Link
            href={`/event/${slug}`}
            className="text-sm font-medium text-emerald-800 underline"
          >
            Lihat Halaman Publik
          </Link>
        )}
      </div>

      {recordId && (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
          <h2 className="text-sm font-bold text-red-900">Zona berbahaya</h2>
          <p className="mt-1 text-sm text-neutral-700">
            Menghapus event juga menghapus berkas posternya dari
            penyimpanan.
          </p>
          <div className="mt-3">
            <DeleteButton
              itemLabel={displayTitle}
              status={status}
              onDelete={async () => {
                const result = await deleteEventAction(recordId);
                if (!result.ok) throw new Error(result.error);
                router.push("/admin/events");
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      <PublishDialog
        open={publishOpen}
        title={`Terbitkan event "${displayTitle}"?`}
        missing={missing}
        onConfirmPublish={() => void handleConfirmPublish()}
        onCancel={() => {
          if (!publishBusy) setPublishOpen(false);
        }}
        onJumpToField={jumpToField}
      />

      <ConfirmDialog
        open={unpublishOpen}
        title={`Batalkan terbit "${displayTitle}"?`}
        body={
          <>
            Event <strong>{displayTitle}</strong> akan berhenti tampil ke
            publik, tetapi datanya tidak hilang dan dapat diterbitkan
            lagi kapan saja.
          </>
        }
        confirmLabel="Batalkan Terbit"
        busy={publishBusy}
        onConfirm={() => void handleConfirmUnpublish()}
        onCancel={() => {
          if (!publishBusy) setUnpublishOpen(false);
        }}
      />
    </form>
  );
}
