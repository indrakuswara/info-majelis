"use client";

// Pemilih penyelenggara tiga jalan (plan Task 9; spec §6.2): profil
// majelis terdaftar (hanya yang sudah TERBIT yang dapat dipilih —
// profil draft tidak tampil ke publik, spec §6.5), nama manual sebagai
// teks biasa, atau kosong. Tiga jalan ini saling meniadakan (radio):
// memilih satu jalan mengosongkan jalan lainnya lewat onChange.

import { useState } from "react";

export interface OrganizerOption {
  id: string;
  name: string;
  city: string;
}

export interface OrganizerPickerProps {
  majelisId: string | null;
  manualName: string;
  /** Profil majelis terbit yang dapat dipilih (dimuat halaman induk). */
  options: OrganizerOption[];
  onChange(v: { majelisId: string | null; manualName: string }): void;
}

type OrganizerMode = "profil" | "manual" | "kosong";

const inputClass =
  "rounded-md border border-neutral-300 px-3 py-2 font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export function OrganizerPicker({
  majelisId,
  manualName,
  options,
  onChange,
}: OrganizerPickerProps) {
  const [mode, setMode] = useState<OrganizerMode>(() =>
    majelisId ? "profil" : manualName.trim() !== "" ? "manual" : "kosong",
  );

  const switchMode = (next: OrganizerMode) => {
    setMode(next);
    if (next === "profil") {
      onChange({ majelisId: majelisId ?? options[0]?.id ?? null, manualName: "" });
    } else if (next === "manual") {
      onChange({ majelisId: null, manualName });
    } else {
      onChange({ majelisId: null, manualName: "" });
    }
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold">Penyelenggara</legend>
      <p className="text-xs font-normal text-neutral-500">
        Opsional. Pilih profil majelis terdaftar, tulis nama penyelenggara
        secara manual, atau kosongkan.
      </p>

      <label className="flex items-start gap-2 text-sm font-medium">
        <input
          type="radio"
          name="organizer-mode"
          checked={mode === "profil"}
          onChange={() => switchMode("profil")}
          className="mt-1"
        />
        <span className="flex flex-1 flex-col gap-1">
          Profil majelis terdaftar
          {mode === "profil" &&
            (options.length === 0 ? (
              <span className="text-xs font-normal text-amber-800">
                Belum ada profil majelis yang terbit. Terbitkan profil
                majelis terlebih dahulu, atau pakai nama manual.
              </span>
            ) : (
              <select
                aria-label="Pilih profil majelis penyelenggara"
                value={majelisId ?? ""}
                onChange={(event) =>
                  onChange({
                    majelisId: event.target.value || null,
                    manualName: "",
                  })
                }
                className={inputClass}
              >
                <option value="">— Pilih majelis —</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.city})
                  </option>
                ))}
              </select>
            ))}
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm font-medium">
        <input
          type="radio"
          name="organizer-mode"
          checked={mode === "manual"}
          onChange={() => switchMode("manual")}
          className="mt-1"
        />
        <span className="flex flex-1 flex-col gap-1">
          Nama manual
          {mode === "manual" && (
            <input
              type="text"
              aria-label="Nama penyelenggara manual"
              value={manualName}
              onChange={(event) =>
                onChange({ majelisId: null, manualName: event.target.value })
              }
              className={inputClass}
              placeholder="cth. Panitia Masjid Al-Ikhlas"
            />
          )}
          <span className="text-xs font-normal text-neutral-500">
            Tampil sebagai teks biasa, tanpa halaman profil.
          </span>
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="radio"
          name="organizer-mode"
          checked={mode === "kosong"}
          onChange={() => switchMode("kosong")}
        />
        Tanpa penyelenggara
      </label>
    </fieldset>
  );
}
