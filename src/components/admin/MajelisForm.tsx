"use client";

// Form profil Majelis (plan Task 8; field persis spec §6.5).
// Pola interaksi spec §8: simpan memakai ActionButton dengan onClick
// async (BUKAN type=submit), indikator perubahan belum disimpan lewat
// useUnsavedChangesGuard, publish lewat PublishDialog + validasi
// Task 3, unpublish lewat ConfirmDialog, hapus lewat DeleteButton
// yang dialognya menyebut jumlah event/rutin terhubung.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { REGIONS } from "../../lib/constants.ts";
import type { MajelisRecord } from "../../lib/domain.ts";
import {
  validateMajelisForPublish,
  type MissingField,
} from "../../lib/validation.ts";
import {
  deleteMajelisAction,
  publishMajelisAction,
  saveMajelisAction,
  unpublishMajelisAction,
  type MajelisSaveInput,
} from "../../app/admin/(protected)/majelis/actions.ts";
import { ActionButton } from "./ActionButton.tsx";
import { useUnsavedChangesGuard } from "./AdminShell.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { DeleteButton } from "./DeleteButton.tsx";
import { ImageUpload } from "./ImageUpload.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { useToast } from "./Toast.tsx";

interface FormFields {
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

function fieldsFromRecord(record: MajelisRecord | null): FormFields {
  return {
    name: record?.name ?? "",
    city: record?.city ?? "",
    leader: record?.leader ?? "",
    logoUrl: record?.logoUrl ?? null,
    photoUrl: record?.photoUrl ?? null,
    baseAddress: record?.baseAddress ?? "",
    baseDistrict: record?.baseDistrict ?? "",
    baseMapsUrl: record?.baseMapsUrl ?? "",
    description: record?.description ?? "",
    instagramUrl: record?.instagramUrl ?? "",
    youtubeUrl: record?.youtubeUrl ?? "",
    tiktokUrl: record?.tiktokUrl ?? "",
    websiteUrl: record?.websiteUrl ?? "",
    contact: record?.contact ?? "",
  };
}

const inputClass =
  "rounded-md border border-neutral-300 px-3 py-2 font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export interface MajelisFormProps {
  initial: MajelisRecord | null;
  /** Jumlah event/rutin yang terhubung (untuk dialog hapus, spec §8). */
  linkedEvents?: number;
  linkedRoutines?: number;
  /** Auto-saran kecamatan dari data yang sudah ada (spec §6.5). */
  districtSuggestions?: string[];
}

export function MajelisForm({
  initial,
  linkedEvents = 0,
  linkedRoutines = 0,
  districtSuggestions = [],
}: MajelisFormProps) {
  const router = useRouter();
  const { show } = useToast();

  const [recordId, setRecordId] = useState<string | null>(initial?.id ?? null);
  const [slug, setSlug] = useState<string | null>(initial?.slug ?? null);
  const [status, setStatus] = useState<MajelisRecord["status"]>(
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

  // Disiplin Task 8 (a): ownerId ImageUpload SELALU id entitas. Untuk
  // majelis baru yang belum punya id, hasilkan UUID lebih dulu di sini —
  // tidak pernah memakai nama tampilan sebagai kunci berkas.
  const [newOwnerId] = useState<string>(() => crypto.randomUUID());
  const ownerId = recordId ?? newOwnerId;

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
      validateMajelisForPublish({
        name: fields.name,
        city: fields.city,
      }),
    [fields.name, fields.city],
  );

  const jumpToField = (field: string) => {
    setPublishOpen(false);
    window.setTimeout(() => {
      const element = document.getElementById(field);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus();
    }, 50);
  };

  /** Simpan form; kembalikan id record (baru/existing) atau null bila gagal. */
  const persist = async (): Promise<string | null> => {
    const input: MajelisSaveInput = {
      id: recordId,
      name: fields.name,
      city: fields.city,
      leader: fields.leader,
      logoUrl: fields.logoUrl,
      photoUrl: fields.photoUrl,
      baseAddress: fields.baseAddress,
      baseDistrict: fields.baseDistrict,
      baseMapsUrl: fields.baseMapsUrl,
      description: fields.description,
      instagramUrl: fields.instagramUrl,
      youtubeUrl: fields.youtubeUrl,
      tiktokUrl: fields.tiktokUrl,
      websiteUrl: fields.websiteUrl,
      contact: fields.contact,
    };
    const result = await saveMajelisAction(input);
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
    return result.id;
  };

  const handleSave = async () => {
    const wasNew = recordId === null;
    const id = await persist();
    if (!id) return;
    show("Draft tersimpan.");
    if (wasNew) {
      router.replace(`/admin/majelis/${id}`);
    } else {
      router.refresh();
    }
  };

  const handleConfirmPublish = async () => {
    if (publishBusyRef.current || missing.length > 0) return;
    publishBusyRef.current = true;
    setPublishBusy(true);
    try {
      // Publish selalu menerbitkan isi form terbaru: simpan dulu bila
      // ada perubahan, baru minta server menerbitkan (server memvalidasi
      // ulang lewat validateMajelisForPublish).
      let id = recordId;
      if (dirty || id === null) {
        id = await persist();
        if (!id) {
          setPublishOpen(false);
          return;
        }
      }
      const result = await publishMajelisAction(id);
      if (!result.ok) {
        show(result.error, "error");
        setPublishOpen(false);
        return;
      }
      setStatus("published");
      setPublishOpen(false);
      show(`Profil "${fields.name.trim()}" berhasil diterbitkan.`);
      router.replace(`/admin/majelis/${id}`);
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
      const result = await unpublishMajelisAction(recordId);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      setStatus("draft");
      setUnpublishOpen(false);
      show(`Profil "${fields.name.trim()}" tidak lagi tampil ke publik.`);
      router.refresh();
    } finally {
      publishBusyRef.current = false;
      setPublishBusy(false);
    }
  };

  const displayName =
    fields.name.trim() === "" ? "(Tanpa nama)" : fields.name.trim();
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
          Nama majelis <span className="text-red-700">*</span>
          <input
            id="name"
            type="text"
            value={fields.name}
            onChange={(event) => set("name", event.target.value)}
            className={inputClass}
            placeholder="cth. Majelis Ta'lim Nurul Huda"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Kota/Kabupaten basis <span className="text-red-700">*</span>
          <select
            id="majelisCity"
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

        <label className="flex flex-col gap-1 text-sm font-medium">
          Pimpinan / pengasuh
          <input
            type="text"
            value={fields.leader}
            onChange={(event) => set("leader", event.target.value)}
            className={inputClass}
            placeholder="cth. Habib / KH. / Ust. …"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Alamat markas
          <input
            type="text"
            value={fields.baseAddress}
            onChange={(event) => set("baseAddress", event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Kecamatan markas
          <input
            type="text"
            list="majelis-district-suggestions"
            value={fields.baseDistrict}
            onChange={(event) => set("baseDistrict", event.target.value)}
            className={inputClass}
          />
          <datalist id="majelis-district-suggestions">
            {districtSuggestions.map((district) => (
              <option key={district} value={district} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Link Google Maps markas
          <input
            type="url"
            value={fields.baseMapsUrl}
            onChange={(event) => set("baseMapsUrl", event.target.value)}
            className={inputClass}
            placeholder="https://maps.google.com/…"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Deskripsi singkat
          <textarea
            value={fields.description}
            onChange={(event) => set("description", event.target.value)}
            rows={4}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <ImageUpload
          label="Logo majelis"
          value={fields.logoUrl}
          kind="logo"
          ownerId={ownerId}
          onChange={(url) => set("logoUrl", url)}
        />
        <ImageUpload
          label="Foto majelis"
          value={fields.photoUrl}
          kind="photo"
          ownerId={ownerId}
          onChange={(url) => set("photoUrl", url)}
        />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">Tautan & kontak</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Instagram
            <input
              type="url"
              value={fields.instagramUrl}
              onChange={(event) => set("instagramUrl", event.target.value)}
              className={inputClass}
              placeholder="https://instagram.com/…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            YouTube
            <input
              type="url"
              value={fields.youtubeUrl}
              onChange={(event) => set("youtubeUrl", event.target.value)}
              className={inputClass}
              placeholder="https://youtube.com/…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            TikTok
            <input
              type="url"
              value={fields.tiktokUrl}
              onChange={(event) => set("tiktokUrl", event.target.value)}
              className={inputClass}
              placeholder="https://tiktok.com/…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Website
            <input
              type="url"
              value={fields.websiteUrl}
              onChange={(event) => set("websiteUrl", event.target.value)}
              className={inputClass}
              placeholder="https://…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Kontak
            <input
              type="text"
              value={fields.contact}
              onChange={(event) => set("contact", event.target.value)}
              className={inputClass}
              placeholder="cth. WhatsApp 08xx-xxxx-xxxx (pengurus)"
            />
            <span className="text-xs font-normal text-amber-800">
              Pengingat: kontak ini akan tampil ke publik di halaman profil
              majelis.
            </span>
          </label>
        </div>
      </fieldset>

      {saveError && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          {saveError} Isi form tidak hilang — silakan coba simpan lagi.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-5">
        <ActionButton
          type="button"
          onClick={handleSave}
          pendingLabel="Menyimpan…"
          className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          Simpan Draft
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

        {status === "published" && slug && (
          <Link
            href={`/majelis/${slug}`}
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
            Menghapus profil tidak menghapus event/jadwal rutin yang
            terhubung — hubungan penyelenggaranya menjadi kosong.
          </p>
          <div className="mt-3">
            <DeleteButton
              itemLabel={displayName}
              status={status}
              detail={
                <>
                  {" "}
                  Saat ini ada {linkedEvents} event dan {linkedRoutines}{" "}
                  jadwal rutin yang terhubung ke profil ini. Event dan jadwal
                  rutin tersebut <strong>tidak ikut terhapus</strong> —
                  hubungan penyelenggaranya menjadi kosong.
                </>
              }
              onDelete={async () => {
                const result = await deleteMajelisAction(recordId);
                if (!result.ok) throw new Error(result.error);
                router.push("/admin/majelis");
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      <PublishDialog
        open={publishOpen}
        title={`Terbitkan profil "${displayName}"?`}
        missing={missing}
        onConfirmPublish={() => void handleConfirmPublish()}
        onCancel={() => {
          if (!publishBusy) setPublishOpen(false);
        }}
        onJumpToField={jumpToField}
      />

      <ConfirmDialog
        open={unpublishOpen}
        title={`Batalkan terbit "${displayName}"?`}
        body={
          <>
            Profil <strong>{displayName}</strong> akan berhenti tampil ke
            publik dan tidak dapat dipilih sebagai penyelenggara, tetapi
            datanya tidak hilang dan dapat diterbitkan lagi kapan saja.
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
