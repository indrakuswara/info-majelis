"use client";

// Pengelolaan Pengecualian jadwal rutin (plan Task 10; spec §6.4 &
// §7 butir 5) — bagian dari halaman edit rutin. Pengecualian disimpan
// SEGERA lewat aksinya sendiri (bukan bagian draft form rutin):
// tambah libur / edisi spesial dan hapus selalu lewat pola §8
// (ActionButton berstatus proses, toast hasil, dialog konfirmasi
// untuk hapus). Tanggal dipilih dari dropdown 12 kemunculan
// berikutnya yang dihitung server; validasi akhir (tanggal kemunculan
// & satu pengecualian per tanggal) ditegakkan repository di server —
// pesan penolakannya tampil apa adanya.

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteExceptionAction,
  saveExceptionAction,
  type ExceptionSaveInput,
} from "../../app/admin/(protected)/routines/actions.ts";
import type {
  ContentStatus,
  ExceptionKind,
  RoutineExceptionRecord,
} from "../../lib/domain.ts";
import { ActionButton } from "./ActionButton.tsx";
import { DeleteButton } from "./DeleteButton.tsx";
import { formatEventDateLabel } from "./EventPreview.tsx";
import { useToast } from "./Toast.tsx";

export interface OccurrenceDateOption {
  date: string;
  label: string;
}

export interface RoutineExceptionsProps {
  routineId: string;
  /** Status rutin induk — untuk peringatan "sedang tayang publik" di dialog hapus. */
  routineStatus: ContentStatus;
  exceptions: RoutineExceptionRecord[];
  /** 12 kemunculan berikutnya yang belum berpengecualian (dari server). */
  occurrenceOptions: OccurrenceDateOption[];
}

const inputClass =
  "rounded-md border border-neutral-300 px-3 py-2 font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export function RoutineExceptions({
  routineId,
  routineStatus,
  exceptions,
  occurrenceOptions,
}: RoutineExceptionsProps) {
  const router = useRouter();
  const { show } = useToast();

  const [kind, setKind] = useState<ExceptionKind>("libur");
  const [date, setDate] = useState<string>(occurrenceOptions[0]?.date ?? "");
  const [note, setNote] = useState("");
  const [overrideVenueName, setOverrideVenueName] = useState("");
  const [overrideAddress, setOverrideAddress] = useState("");
  const [overrideStartTime, setOverrideStartTime] = useState("");
  const [overrideDescription, setOverrideDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (date === "") {
      setFormError(
        "Tidak ada tanggal kemunculan yang dapat dipilih. Periksa pola & tanggal berlaku jadwal ini.",
      );
      return;
    }
    const input: ExceptionSaveInput = {
      routineId,
      kind,
      date,
      note,
      overrideVenueName,
      overrideAddress,
      overrideStartTime,
      overrideDescription,
    };
    const result = await saveExceptionAction(input);
    if (!result.ok) {
      setFormError(result.error);
      show(result.error, "error");
      return;
    }
    setFormError(null);
    setNote("");
    setOverrideVenueName("");
    setOverrideAddress("");
    setOverrideStartTime("");
    setOverrideDescription("");
    show(
      kind === "libur"
        ? `Libur pada ${formatEventDateLabel(date)} tersimpan.`
        : `Edisi spesial pada ${formatEventDateLabel(date)} tersimpan.`,
    );
    router.refresh();
  };

  return (
    <section
      aria-label="Pengecualian jadwal rutin"
      className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-bold">Pengecualian</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Libur pada tanggal tertentu, atau edisi spesial (pindah tempat /
        ganti jam / tema khusus) pada satu tanggal kemunculan. Setiap
        tanggal hanya boleh punya satu pengecualian. Pengecualian
        tersimpan segera — terpisah dari draft form di atas.
      </p>

      <h3 className="mt-5 text-sm font-semibold">
        Pengecualian tersimpan ({exceptions.length})
      </h3>
      {exceptions.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">
          Belum ada pengecualian. Semua kemunculan berjalan seperti pola.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
          {exceptions.map((exception) => (
            <li
              key={exception.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {formatEventDateLabel(exception.date)}
                  {exception.kind === "libur" ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      Libur
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                      Edisi Spesial
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-neutral-600">
                  {exception.note ?? "Tanpa keterangan"}
                  {exception.kind === "edisi-spesial" && (
                    <>
                      {exception.overrideVenueName &&
                        ` · Tempat: ${exception.overrideVenueName}`}
                      {exception.overrideAddress &&
                        ` · Alamat: ${exception.overrideAddress}`}
                      {exception.overrideStartTime &&
                        ` · Jam mulai: ${exception.overrideStartTime} WIB`}
                    </>
                  )}
                </p>
                {exception.kind === "edisi-spesial" &&
                  exception.overrideDescription && (
                    <p className="mt-0.5 text-sm text-neutral-600">
                      {exception.overrideDescription}
                    </p>
                  )}
              </div>
              <DeleteButton
                itemLabel={`Pengecualian ${formatEventDateLabel(exception.date)}`}
                status={routineStatus}
                detail={
                  <>
                    {" "}
                    Kemunculan tanggal tersebut akan kembali mengikuti
                    pola biasa jadwal rutin ini.
                  </>
                }
                onDelete={async () => {
                  const result = await deleteExceptionAction(
                    exception.id,
                    routineId,
                  );
                  if (!result.ok) throw new Error(result.error);
                  router.refresh();
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-semibold">Tambah pengecualian</h3>
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name="exception-kind"
              checked={kind === "libur"}
              onChange={() => setKind("libur")}
            />
            Libur
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name="exception-kind"
              checked={kind === "edisi-spesial"}
              onChange={() => setKind("edisi-spesial")}
            />
            Edisi Spesial
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tanggal kemunculan <span className="text-red-700">*</span>
            {occurrenceOptions.length === 0 ? (
              <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-normal text-amber-900">
                Tidak ada kemunculan berikutnya yang dapat dipilih
                (pola belum lengkap, atau 12 kemunculan berikutnya sudah
                berpengecualian semua).
              </span>
            ) : (
              <select
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={inputClass}
              >
                {occurrenceOptions.map((option) => (
                  <option key={option.date} value={option.date}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs font-normal text-neutral-500">
              Hanya tanggal yang memang kemunculan pola jadwal ini (12
              berikutnya, yang belum berpengecualian).
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {kind === "libur" ? "Alasan / keterangan" : "Judul / keterangan edisi"}
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={inputClass}
              placeholder={
                kind === "libur"
                  ? "cth. Libur Lebaran"
                  : "cth. Edisi Spesial Maulid Akbar"
              }
            />
            <span className="text-xs font-normal text-neutral-500">
              Tampil ke publik pada detail jadwal.
            </span>
          </label>
        </div>

        {kind === "edisi-spesial" && (
          <div className="grid gap-4 rounded-xl border border-purple-200 bg-purple-50/50 p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Override nama tempat
              <input
                type="text"
                value={overrideVenueName}
                onChange={(event) => setOverrideVenueName(event.target.value)}
                className={inputClass}
                placeholder="Kosongkan = pakai tempat induk"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Override jam mulai
              <input
                type="time"
                value={overrideStartTime}
                onChange={(event) => setOverrideStartTime(event.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-normal text-neutral-500">
                Kosongkan = pakai jam induk. Jam selesai edisi spesial
                mengikuti jam selesai induk.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Override alamat
              <input
                type="text"
                value={overrideAddress}
                onChange={(event) => setOverrideAddress(event.target.value)}
                className={inputClass}
                placeholder="Kosongkan = pakai alamat induk"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Deskripsi edisi spesial
              <textarea
                value={overrideDescription}
                onChange={(event) =>
                  setOverrideDescription(event.target.value)
                }
                rows={3}
                className={inputClass}
                placeholder="cth. Tema khusus dan susunan acara edisi ini…"
              />
            </label>
          </div>
        )}

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          >
            {formError}
          </p>
        )}

        <div>
          <ActionButton
            type="button"
            onClick={handleAdd}
            pendingLabel="Menyimpan…"
            className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
          >
            {kind === "libur" ? "Tambah Libur" : "Tambah Edisi Spesial"}
          </ActionButton>
        </div>
      </div>
    </section>
  );
}
