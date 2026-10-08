"use client";

// Form Jadwal Rutin (plan Task 10; field §6.3 = §6.2 dengan tanggal
// diganti pola pengulangan 3 jenis). Pola interaksi spec §8 meniru
// EventForm Task 9 persis: simpan via ActionButton async, indikator
// belum disimpan + "Terakhir disimpan", publish lewat PublishDialog
// dengan daftar kurang yang dapat diklik, unpublish lewat
// ConfirmDialog, hapus lewat DeleteButton, penjaga §14 ditegakkan
// server di saveRoutineAction. Disiplin gambar sama: ImageUpload tidak
// menghapus berkas; berkas poster lama dihapus form ini SETELAH simpan
// berhasil; ownerId selalu id entitas.
//
// Panel "Kemunculan berikutnya" dihitung LIVE di klien dari
// computeOccurrences yang sama dengan server (lib/recurrence.ts),
// memakai pola & pengecualian tersimpan — libur tidak tampil, edisi
// spesial tampil dengan override-nya.
//
// Hari yang disimpan adalah hari kalender saat acara DIMULAI
// (spec §6.3): acara "malam Jumat" dimulai Kamis malam → disimpan
// Kamis. Form membantu lewat penjelas + tombol "Malam sebelumnya" dan
// keterangan pola dari describePattern.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  deleteRoutineAction,
  publishRoutineAction,
  saveRoutineAction,
  unpublishRoutineAction,
  type RoutineSaveInput,
} from "../../app/admin/(protected)/routines/actions.ts";
import { deleteImageAction } from "../../app/admin/(protected)/upload-action.ts";
import { CATEGORIES, REGIONS } from "../../lib/constants.ts";
import type {
  Audience,
  Category,
  RoutineExceptionRecord,
  RoutineRecord,
} from "../../lib/domain.ts";
import {
  WEEKDAY_NAMES,
  computeOccurrences,
  describePattern,
} from "../../lib/recurrence.ts";
import { nowWibISO } from "../../lib/utils.ts";
import {
  validateRoutineForPublish,
  type MissingField,
} from "../../lib/validation.ts";
import { ActionButton } from "./ActionButton.tsx";
import { useUnsavedChangesGuard } from "./AdminShell.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { DeleteButton } from "./DeleteButton.tsx";
import { formatEventDateLabel } from "./EventPreview.tsx";
import { ImageUpload } from "./ImageUpload.tsx";
import {
  OrganizerPicker,
  type OrganizerOption,
} from "./OrganizerPicker.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { RoutinePreview } from "./RoutinePreview.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { useToast } from "./Toast.tsx";
import {
  buildPatternFromParts,
  patternPartsFromPattern,
  type PatternKind,
} from "./routine-pattern.ts";

interface FormFields {
  title: string;
  category: string;
  patternKind: PatternKind;
  weeklyWeekday: number | null;
  monthlyDayOfMonth: number | null;
  monthlyWeekday: number | null;
  monthlyWeekOfMonth: string;
  startTime: string;
  endTime: string;
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
  speakersText: string;
  audience: Audience;
  liveStreamUrl: string;
  contact: string;
  extraInfo: string;
  libraryUrl: string;
  sourceInfo: string;
}

function fieldsFromRecord(record: RoutineRecord | null): FormFields {
  const parts = record
    ? patternPartsFromPattern(record.pattern)
    : {
        patternKind: "weekly" as PatternKind,
        weeklyWeekday: null,
        monthlyDayOfMonth: null,
        monthlyWeekday: null,
        monthlyWeekOfMonth: "",
      };
  return {
    title: record?.title ?? "",
    category: record?.category ?? "",
    ...parts,
    // Jam penanda "00:00" (draft tanpa jam mulai) ditampilkan kembali
    // sebagai kosong di form — cermin gerbang server di actions.
    startTime:
      record && record.startTime === "00:00" ? "" : (record?.startTime ?? ""),
    endTime: record?.endTime ?? "",
    effectiveFrom: record?.effectiveFrom ?? "",
    effectiveTo: record?.effectiveTo ?? "",
    specialNote: record?.specialNote ?? "",
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

export interface RoutineFormProps {
  initial: RoutineRecord | null;
  /** Profil majelis TERBIT yang dapat dipilih sebagai penyelenggara. */
  organizerOptions: OrganizerOption[];
  /** Auto-saran kecamatan per kota dari listKnownDistricts (Task 4). */
  districtSuggestionsByCity: Record<string, string[]>;
  /** Pengecualian tersimpan (untuk pratinjau kemunculan); halaman edit saja. */
  exceptions?: RoutineExceptionRecord[];
}

export function RoutineForm({
  initial,
  organizerOptions,
  districtSuggestionsByCity,
  exceptions = [],
}: RoutineFormProps) {
  const router = useRouter();
  const { show } = useToast();

  const [recordId, setRecordId] = useState<string | null>(initial?.id ?? null);
  const [slug, setSlug] = useState<string | null>(initial?.slug ?? null);
  const [status, setStatus] = useState<RoutineRecord["status"]>(
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
  const [nowISO] = useState<string>(() => nowWibISO());

  // ownerId ImageUpload SELALU id entitas (pola EventForm): untuk
  // rutin baru hasilkan UUID lebih dulu agar key berkas tidak
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

  const pattern = useMemo(
    () =>
      buildPatternFromParts({
        patternKind: fields.patternKind,
        weeklyWeekday: fields.weeklyWeekday,
        monthlyDayOfMonth: fields.monthlyDayOfMonth,
        monthlyWeekday: fields.monthlyWeekday,
        monthlyWeekOfMonth: fields.monthlyWeekOfMonth,
      }),
    [
      fields.patternKind,
      fields.weeklyWeekday,
      fields.monthlyDayOfMonth,
      fields.monthlyWeekday,
      fields.monthlyWeekOfMonth,
    ],
  );

  const patternDescription = describePattern(pattern, {
    startTime: fields.startTime === "" ? null : fields.startTime,
  });

  const missing: MissingField[] = useMemo(
    () =>
      validateRoutineForPublish({
        title: fields.title,
        category: fields.category as Category,
        pattern,
        startTime: fields.startTime,
        venueName: fields.venueName,
        address: fields.address,
        city: fields.city,
        district: fields.district,
      }),
    [
      fields.title,
      fields.category,
      pattern,
      fields.startTime,
      fields.venueName,
      fields.address,
      fields.city,
      fields.district,
    ],
  );

  // Kemunculan berikutnya LIVE dari nilai form saat ini + pengecualian
  // tersimpan — library & aturan yang sama persis dengan server.
  const occurrences = useMemo(() => {
    try {
      return computeOccurrences(
        {
          pattern,
          startTime: fields.startTime === "" ? "00:00" : fields.startTime,
          endTime: fields.endTime === "" ? null : fields.endTime,
          effectiveFrom: fields.effectiveFrom === "" ? null : fields.effectiveFrom,
          effectiveTo: fields.effectiveTo === "" ? null : fields.effectiveTo,
          venueName: fields.venueName,
          address: fields.address,
        },
        exceptions,
        nowISO,
        6,
      );
    } catch {
      return [];
    }
  }, [
    pattern,
    fields.startTime,
    fields.endTime,
    fields.effectiveFrom,
    fields.effectiveTo,
    fields.venueName,
    fields.address,
    exceptions,
    nowISO,
  ]);

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
    const input: RoutineSaveInput = {
      id: recordId,
      title: fields.title,
      category: fields.category,
      patternKind: fields.patternKind,
      weeklyWeekday: fields.weeklyWeekday,
      monthlyDayOfMonth: fields.monthlyDayOfMonth,
      monthlyWeekday: fields.monthlyWeekday,
      monthlyWeekOfMonth: fields.monthlyWeekOfMonth,
      startTime: fields.startTime,
      endTime: fields.endTime,
      effectiveFrom: fields.effectiveFrom,
      effectiveTo: fields.effectiveTo,
      specialNote: fields.specialNote,
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
    const result = await saveRoutineAction(input);
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
      router.replace(`/admin/routines/${id}/edit`);
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
      const result = await publishRoutineAction(id);
      if (!result.ok) {
        show(result.error, "error");
        setPublishOpen(false);
        return;
      }
      setStatus("published");
      setPublishOpen(false);
      show(`Jadwal rutin "${fields.title.trim()}" berhasil diterbitkan.`);
      router.replace(`/admin/routines/${id}/edit`);
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
      const result = await unpublishRoutineAction(recordId);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      setStatus("draft");
      setUnpublishOpen(false);
      show(
        `Jadwal rutin "${fields.title.trim()}" tidak lagi tampil ke publik.`,
      );
      router.refresh();
    } finally {
      publishBusyRef.current = false;
      setPublishBusy(false);
    }
  };

  const weekdaySelect = (
    value: number | null,
    onChange: (value: number | null) => void,
    ariaLabel: string,
  ) => (
    <select
      aria-label={ariaLabel}
      value={value === null ? "" : String(value)}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
      className={inputClass}
    >
      <option value="">— Pilih hari —</option>
      {WEEKDAY_NAMES.map((name, index) => (
        <option key={name} value={index}>
          {name}
        </option>
      ))}
    </select>
  );

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
        {initial &&
          (initial.isActive ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Aktif
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
              Nonaktif
            </span>
          ))}
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
          Judul jadwal rutin <span className="text-red-700">*</span>
          <input
            id="title"
            type="text"
            value={fields.title}
            onChange={(event) => set("title", event.target.value)}
            className={inputClass}
            placeholder="cth. Pengajian Rutin Malam Jumat"
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
      </div>

      <fieldset
        id="pattern"
        tabIndex={-1}
        className="flex flex-col gap-4 rounded-2xl border border-neutral-200 p-5 focus:outline-none"
      >
        <legend className="px-1 text-sm font-semibold">
          Pola pengulangan <span className="text-red-700">*</span>
        </legend>

        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="radio"
            name="pattern-kind"
            checked={fields.patternKind === "weekly"}
            onChange={() => set("patternKind", "weekly")}
            className="mt-1"
          />
          <span className="flex flex-1 flex-col gap-2">
            Mingguan — setiap minggu pada hari yang sama
            {fields.patternKind === "weekly" && (
              <>
                {weekdaySelect(fields.weeklyWeekday, (value) =>
                  set("weeklyWeekday", value),
                  "Hari pelaksanaan mingguan",
                )}
                <span className="text-xs font-normal leading-5 text-neutral-600">
                  Hari yang disimpan adalah <strong>hari kalender saat
                  acara dimulai</strong>. Acara yang dikenal jamaah
                  sebagai &quot;malam Jumat&quot; sebenarnya dimulai{" "}
                  <strong>Kamis malam</strong> — simpan sebagai Kamis.
                  {fields.weeklyWeekday !== null && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "weeklyWeekday",
                            ((fields.weeklyWeekday ?? 0) + 6) % 7,
                          )
                        }
                        className="font-semibold text-emerald-800 underline"
                      >
                        Malam sebelumnya
                      </button>{" "}
                      — pakai tombol ini bila nama malamnya yang kamu
                      ingat (malam{" "}
                      {WEEKDAY_NAMES[((fields.weeklyWeekday ?? 0) + 1) % 7]}
                      ).
                    </>
                  )}
                </span>
              </>
            )}
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="radio"
            name="pattern-kind"
            checked={fields.patternKind === "monthly-date"}
            onChange={() => set("patternKind", "monthly-date")}
            className="mt-1"
          />
          <span className="flex flex-1 flex-col gap-2">
            Bulanan — tanggal tetap setiap bulan
            {fields.patternKind === "monthly-date" && (
              <>
                <select
                  aria-label="Tanggal pelaksanaan bulanan"
                  value={
                    fields.monthlyDayOfMonth === null
                      ? ""
                      : String(fields.monthlyDayOfMonth)
                  }
                  onChange={(event) =>
                    set(
                      "monthlyDayOfMonth",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                  className={inputClass}
                >
                  <option value="">— Pilih tanggal —</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Tanggal {day}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-neutral-600">
                  Tanggal 29–31 dilewati pada bulan yang tidak memilikinya
                  (tidak digeser).
                </span>
              </>
            )}
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="radio"
            name="pattern-kind"
            checked={fields.patternKind === "monthly-weekday"}
            onChange={() => set("patternKind", "monthly-weekday")}
            className="mt-1"
          />
          <span className="flex flex-1 flex-col gap-2">
            Bulanan — hari tertentu di minggu ke-berapa
            {fields.patternKind === "monthly-weekday" && (
              <span className="grid gap-3 sm:grid-cols-2">
                <select
                  aria-label="Minggu ke-berapa"
                  value={fields.monthlyWeekOfMonth}
                  onChange={(event) =>
                    set("monthlyWeekOfMonth", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">— Pilih minggu —</option>
                  <option value="1">Ke-1</option>
                  <option value="2">Ke-2</option>
                  <option value="3">Ke-3</option>
                  <option value="4">Ke-4</option>
                  <option value="5">Ke-5</option>
                  <option value="last">Terakhir</option>
                </select>
                {weekdaySelect(fields.monthlyWeekday, (value) =>
                  set("monthlyWeekday", value),
                  "Hari pelaksanaan bulanan minggu-ke",
                )}
                <span className="text-xs font-normal text-neutral-600 sm:col-span-2">
                  Hari yang disimpan adalah hari kalender saat acara
                  dimulai — acara &quot;malam Sabtu&quot; dimulai Jumat
                  malam, simpan sebagai Jumat. Minggu ke-5 yang tidak ada
                  pada suatu bulan dilewati ke bulan berikutnya.
                </span>
              </span>
            )}
          </span>
        </label>

        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          Pola tersimpan: {patternDescription}
          {fields.startTime !== "" && `, pukul ${fields.startTime} WIB`}
        </p>

        <div>
          <h3 className="text-sm font-semibold">
            Kemunculan berikutnya (pratinjau langsung)
          </h3>
          {occurrences.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-600">
              Belum dapat dihitung — lengkapi pola (dan tanggal berlaku
              bila diisi) untuk melihat kemunculan.
            </p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {occurrences.map((occurrence) => (
                <li
                  key={occurrence.date}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {formatEventDateLabel(occurrence.date)}
                  </span>{" "}
                  · {occurrence.startTime} WIB
                  {occurrence.exceptionKind === "edisi-spesial" && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                      Edisi Spesial
                    </span>
                  )}
                  {occurrence.isOngoing && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      Sedang berlangsung
                    </span>
                  )}
                  {occurrence.exceptionKind === "edisi-spesial" &&
                    occurrence.note && (
                      <span className="mt-0.5 block text-neutral-600">
                        {occurrence.note}
                      </span>
                    )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Dihitung dari pola form saat ini + pengecualian tersimpan.
            Tanggal yang terkena libur tidak tampil di daftar ini.
          </p>
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
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
          Tanggal mulai berlaku
          <input
            type="date"
            value={fields.effectiveFrom}
            onChange={(event) => set("effectiveFrom", event.target.value)}
            className={inputClass}
          />
          <span className="text-xs font-normal text-neutral-500">
            Opsional — jadwal mulai ditampilkan sejak tanggal ini.
            Kosongkan bila berlaku sejak dibuat.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tanggal berakhir berlaku
          <input
            type="date"
            value={fields.effectiveTo}
            onChange={(event) => set("effectiveTo", event.target.value)}
            className={inputClass}
          />
          <span className="text-xs font-normal text-neutral-500">
            Opsional — jadwal berhenti tampil setelah tanggal ini.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Keterangan khusus
          <textarea
            value={fields.specialNote}
            onChange={(event) => set("specialNote", event.target.value)}
            rows={2}
            className={inputClass}
            placeholder="cth. Pelaksanaan mengikuti jadwal yang diumumkan di masjid"
          />
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
            list="routine-district-suggestions"
            value={fields.district}
            onChange={(event) => set("district", event.target.value)}
            className={inputClass}
            placeholder="cth. Bekasi Timur"
          />
          <datalist id="routine-district-suggestions">
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
        label="Poster jadwal rutin"
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
              detail jadwal rutin.
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
          (belum tentu tersimpan), termasuk 6 kemunculan berikutnya.
          Tanpa poster, tampil fallback design berwarna kategori.
        </p>
        {previewOpen && (
          <div className="mt-4">
            <RoutinePreview
              data={{
                title: fields.title,
                category: fields.category as Category | "",
                patternDescription,
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
                specialNote:
                  fields.specialNote === "" ? null : fields.specialNote,
                effectiveFrom:
                  fields.effectiveFrom === "" ? null : fields.effectiveFrom,
                effectiveTo:
                  fields.effectiveTo === "" ? null : fields.effectiveTo,
                isActive: initial?.isActive ?? true,
                occurrences,
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
            href={`/admin/routines/${recordId}/preview`}
            className="text-sm font-medium text-emerald-800 underline"
          >
            Pratinjau halaman penuh
          </Link>
        )}
        {status === "published" && slug && (
          <Link
            href={`/acara/${slug}`}
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
            Menghapus jadwal rutin juga menghapus berkas posternya dari
            penyimpanan dan seluruh pengecualiannya.
          </p>
          <div className="mt-3">
            <DeleteButton
              itemLabel={displayTitle}
              status={status}
              onDelete={async () => {
                const result = await deleteRoutineAction(recordId);
                if (!result.ok) throw new Error(result.error);
                router.push("/admin/routines");
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      <PublishDialog
        open={publishOpen}
        title={`Terbitkan jadwal rutin "${displayTitle}"?`}
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
            Jadwal rutin <strong>{displayTitle}</strong> akan berhenti
            tampil ke publik, tetapi datanya tidak hilang dan dapat
            diterbitkan lagi kapan saja.
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
