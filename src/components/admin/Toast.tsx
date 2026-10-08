"use client";

// Primitif toast admin (plan Task 7, spec §8): tidak ada aksi yang bekerja
// diam-diam — ToastProvider menyediakan show() untuk seluruh area admin.
// Toast hilang otomatis setelah 4 detik.

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  show(message: string, kind?: ToastKind): void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={
              toast.kind === "error"
                ? "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-lg bg-red-700 px-4 py-3 text-sm font-medium text-white shadow-lg"
                : "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg"
            }
          >
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded px-1 text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
