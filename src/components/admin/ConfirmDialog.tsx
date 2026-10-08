"use client";

// Dialog konfirmasi admin (plan Task 7, spec §8).
// Aman secara default: fokus awal selalu pada Batal, Escape/backdrop
// membatalkan, dan aksi hanya berjalan setelah klik konfirmasi eksplisit.

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** Nama yang dipakai plan Task 7 untuk gaya berbahaya. */
  danger?: boolean;
  /** Alias gaya berbahaya yang dipakai pada brief Task 7. */
  destructive?: boolean;
  publishedWarning?: boolean;
  busy?: boolean;
  /** Tambahan untuk PublishDialog: tombol konfirmasi nonaktif tanpa status sibuk. */
  confirmDisabled?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  destructive = false,
  publishedWarning = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isDanger = danger || destructive;

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Fokus default SELALU Batal (spec §8), bukan tombol aksi.
    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onCancel();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden && element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !busy) onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {isDanger && (
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-xl text-red-700"
            >
              ⚠
            </span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-neutral-900">
              {title}
            </h2>
            <div id={bodyId} className="mt-2 text-sm leading-6 text-neutral-700">
              {body}
            </div>
          </div>
        </div>

        {publishedWarning && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          >
            Peringatan: item ini sedang tayang publik. Perubahan atau
            penghapusan akan langsung berdampak pada halaman yang dilihat
            jamaah.
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
            aria-busy={busy}
            className={
              isDanger
                ? "inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                : "inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {busy && <Spinner />}
            {busy ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
