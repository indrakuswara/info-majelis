"use client";

// Kerangka klien area admin (plan Task 7): memasang ToastProvider dan
// penjaga perubahan belum disimpan dari spec §8.
//
// Form pada Task 8–10 cukup memanggil useUnsavedChangesGuard(dirty).
// Saat ada form kotor, shell menampilkan indikator, browser memberi
// peringatan sebelum tab ditutup/di-refresh, dan klik tautan internal
// meminta konfirmasi terlebih dahulu.

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ToastProvider } from "./Toast.tsx";

const dirtyOwners = new Set<symbol>();
const dirtyListeners = new Set<() => void>();

function notifyDirtyListeners() {
  dirtyListeners.forEach((listener) => listener());
}

function subscribeDirty(listener: () => void) {
  dirtyListeners.add(listener);
  return () => {
    dirtyListeners.delete(listener);
  };
}

function getDirtySnapshot() {
  return dirtyOwners.size > 0;
}

function getDirtyServerSnapshot() {
  return false;
}

function setDirtyOwner(owner: symbol, dirty: boolean) {
  const before = dirtyOwners.size;
  if (dirty) dirtyOwners.add(owner);
  else dirtyOwners.delete(owner);
  if (dirtyOwners.size !== before) notifyDirtyListeners();
}

export function useUnsavedChangesGuard(dirty: boolean): void {
  const ownerRef = useRef<symbol | null>(null);
  if (ownerRef.current === null) {
    ownerRef.current = Symbol("unsaved-changes");
  }

  useEffect(() => {
    const owner = ownerRef.current;
    if (!owner) return;
    setDirtyOwner(owner, dirty);
    return () => setDirtyOwner(owner, false);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      const leave = window.confirm(
        "Ada perubahan yang belum disimpan. Jika Anda pindah halaman sekarang, perubahan itu akan hilang. Lanjutkan?",
      );
      if (!leave) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [dirty]);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const hasUnsavedChanges = useSyncExternalStore(
    subscribeDirty,
    getDirtySnapshot,
    getDirtyServerSnapshot,
  );

  return (
    <ToastProvider>
      {hasUnsavedChanges && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-sm font-medium text-amber-900"
        >
          ⚠ Ada perubahan belum disimpan
        </div>
      )}
      {children}
    </ToastProvider>
  );
}
