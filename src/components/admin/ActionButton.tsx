"use client";

// Tombol aksi async admin (Task 7, spec §8): selama proses berjalan,
// tombol nonaktif, menampilkan spinner + label proses, dan klik tambahan
// diabaikan agar submit/aksi yang sama tidak berjalan dua kali.
//
// Dapat dipakai dengan onClick async biasa, atau sebagai tombol submit di
// dalam <form>—pada pemakaian form, status pending Server Action dibaca
// lewat useFormStatus dari react-dom.

import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from "react";
import { useFormStatus } from "react-dom";

export interface ActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label yang ditampilkan selama proses berjalan. */
  pendingLabel?: string;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
  );
}

export function ActionButton({
  children,
  className = "",
  disabled = false,
  onClick,
  pendingLabel = "Memproses…",
  type = "button",
  ...props
}: ActionButtonProps) {
  const formStatus = useFormStatus();
  const [ownPending, setOwnPending] = useState(false);
  const pendingRef = useRef(false);
  const pending = ownPending || formStatus.pending;

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (pendingRef.current || formStatus.pending) {
      event.preventDefault();
      return;
    }
    if (!onClick) return;

    pendingRef.current = true;
    setOwnPending(true);
    try {
      await onClick(event);
    } finally {
      pendingRef.current = false;
      setOwnPending(false);
    }
  };

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? (
        <>
          <Spinner />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
