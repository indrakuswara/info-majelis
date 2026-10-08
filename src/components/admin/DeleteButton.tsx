"use client";

// Tombol hapus aman (plan Task 7, spec §8): tidak pernah menghapus
// langsung. Klik pertama hanya membuka ConfirmDialog; penghapusan baru
// berjalan setelah admin mengklik "Hapus permanen" secara eksplisit.

import { useRef, useState } from "react";
import type { ContentStatus } from "../../lib/domain.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { useToast } from "./Toast.tsx";

export interface DeleteButtonProps {
  itemLabel: string;
  status: ContentStatus;
  onDelete(): Promise<void>;
}

export function DeleteButton({
  itemLabel,
  status,
  onDelete,
}: DeleteButtonProps) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onDelete();
      setOpen(false);
      show(`"${itemLabel}" berhasil dihapus.`, "success");
    } catch {
      show(
        `Gagal menghapus "${itemLabel}". Silakan coba lagi.`,
        "error",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Hapus
      </button>

      <ConfirmDialog
        open={open}
        title={`Hapus "${itemLabel}"?`}
        body={
          <>
            <strong className="font-semibold text-neutral-900">
              {itemLabel}
            </strong>{" "}
            akan dihapus secara permanen dan tidak dapat dikembalikan.
          </>
        }
        confirmLabel="Hapus permanen"
        danger
        publishedWarning={status === "published"}
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (!busyRef.current) setOpen(false);
        }}
      />
    </>
  );
}
