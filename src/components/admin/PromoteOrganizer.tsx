"use client";

// Promosi nama penyelenggara manual → profil Majelis (plan Task 8,
// spec §6.5 & §8): tombol hanya membuka ConfirmDialog yang menyebut
// nama + jumlah event/rutin yang akan otomatis terhubung; promosi baru
// berjalan setelah konfirmasi eksplisit, lalu toast hasil ditampilkan.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ManualOrganizerGroup } from "../../lib/db.ts";
import { promoteOrganizerAction } from "../../app/admin/(protected)/majelis/actions.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { useToast } from "./Toast.tsx";

export function PromoteOrganizer({ groups }: { groups: ManualOrganizerGroup[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [selected, setSelected] = useState<ManualOrganizerGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  if (groups.length === 0) return null;

  const handleConfirm = async () => {
    if (!selected || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await promoteOrganizerAction(selected.name, selected.city);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      setSelected(null);
      show(
        `Profil majelis "${result.majelisName}" diterbitkan dan terhubung ke ${result.linkedEvents} event dan ${result.linkedRoutines} jadwal rutin.`,
      );
      router.refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="promosi-penyelenggara"
      className="mt-10 rounded-2xl border border-neutral-200 bg-white shadow-sm"
    >
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 id="promosi-penyelenggara" className="text-lg font-bold">
          Nama penyelenggara manual yang sering muncul
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Nama manual yang dipakai minimal 2 event/jadwal rutin dapat
          dijadikan profil majelis; seluruh item dengan nama persis sama
          otomatis terhubung ke profil baru.
        </p>
      </div>
      <ul className="divide-y divide-neutral-200">
        {groups.map((group) => {
          const total = group.eventCount + group.routineCount;
          return (
            <li
              key={`${group.name}|${group.city}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{group.name}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {group.city} · {group.eventCount} event ·{" "}
                  {group.routineCount} jadwal rutin ({total} total)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(group)}
                className="rounded-md border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Jadikan Profil Majelis
              </button>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={selected !== null}
        title={
          selected ? `Jadikan "${selected.name}" profil majelis?` : ""
        }
        body={
          selected ? (
            <>
              Profil majelis <strong>{selected.name}</strong> ({selected.city})
              akan dibuat dan langsung diterbitkan. Sebanyak{" "}
              <strong>
                {selected.eventCount + selected.routineCount} item
              </strong>{" "}
              akan otomatis terhubung ke profil ini: {selected.eventCount}{" "}
              event dan {selected.routineCount} jadwal rutin yang memakai
              nama penyelenggara manual persis sama.
            </>
          ) : null
        }
        confirmLabel="Jadikan Profil Majelis"
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (!busyRef.current) setSelected(null);
        }}
      />
    </section>
  );
}
