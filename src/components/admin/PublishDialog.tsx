"use client";

// Dialog publish interaktif (plan Task 7, spec §8): field wajib yang
// belum lengkap ditolak di dalam dialog dan dapat diklik untuk melompat
// ke field terkait pada form pemiliknya.

import type { MissingField } from "../../lib/validation.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";

export interface PublishDialogProps {
  open: boolean;
  title: string;
  missing: MissingField[];
  onConfirmPublish(): void;
  onCancel(): void;
  onJumpToField(field: string): void;
}

export function PublishDialog({
  open,
  title,
  missing,
  onConfirmPublish,
  onCancel,
  onJumpToField,
}: PublishDialogProps) {
  const hasMissing = missing.length > 0;

  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel="Terbitkan"
      confirmDisabled={hasMissing}
      onConfirm={onConfirmPublish}
      onCancel={onCancel}
      body={
        hasMissing ? (
          <div>
            <p>
              Field wajib berikut belum lengkap. Lengkapi dulu sebelum
              menerbitkan:
            </p>
            <ul className="mt-3 space-y-2">
              {missing.map((item) => (
                <li key={`${item.field}-${item.label}`}>
                  <button
                    type="button"
                    onClick={() => onJumpToField(item.field)}
                    className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left font-medium text-amber-900 hover:bg-amber-100"
                  >
                    {item.label}
                    <span className="mt-0.5 block text-xs font-normal">
                      Klik untuk menuju field ini
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="font-medium text-emerald-800">
              ✓ Semua field wajib sudah lengkap.
            </p>
            <p className="mt-2">
              Setelah diterbitkan, konten ini langsung tampil untuk publik.
              Pastikan judul, waktu, dan lokasi sudah benar.
            </p>
          </div>
        )
      }
    />
  );
}
