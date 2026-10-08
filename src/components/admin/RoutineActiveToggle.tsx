"use client";

// Toggle aktif/nonaktif jadwal rutin (plan Task 10; spec §6.3):
// jadwal terbit dapat dinonaktifkan sementara (mis. selama Ramadan)
// tanpa menghapus dan tanpa mengubah status terbitnya. Selalu lewat
// ConfirmDialog + toast (spec §8) — tidak ada perubahan diam-diam.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { setRoutineActiveAction } from "../../app/admin/(protected)/routines/actions.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { useToast } from "./Toast.tsx";

export interface RoutineActiveToggleProps {
  id: string;
  title: string;
  isActive: boolean;
}

export function RoutineActiveToggle({
  id,
  title,
  isActive,
}: RoutineActiveToggleProps) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await setRoutineActiveAction(id, !isActive);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      setOpen(false);
      show(
        isActive
          ? `Jadwal rutin "${title}" dinonaktifkan — tidak tampil ke publik.`
          : `Jadwal rutin "${title}" diaktifkan kembali.`,
      );
      router.refresh();
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
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </button>

      <ConfirmDialog
        open={open}
        title={
          isActive
            ? `Nonaktifkan "${title}"?`
            : `Aktifkan "${title}"?`
        }
        body={
          isActive ? (
            <>
              Jadwal rutin <strong>{title}</strong> berhenti tampil ke
              publik selama nonaktif, tetapi datanya tidak hilang dan
              status terbitnya tidak berubah. Aktifkan lagi kapan saja.
            </>
          ) : (
            <>
              Jadwal rutin <strong>{title}</strong> tampil kembali ke
              publik (bila statusnya terbit) sesuai pola & kemunculan
              berikutnya.
            </>
          )
        }
        confirmLabel={isActive ? "Nonaktifkan" : "Aktifkan"}
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (!busyRef.current) setOpen(false);
        }}
      />
    </>
  );
}
