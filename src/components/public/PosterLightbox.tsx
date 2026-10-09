"use client";

// Poster yang bisa diklik untuk dibuka sebagai popup perbesar
// (lightbox) — permintaan Juple 2026-10-09 agar poster/banner bisa
// "di-hit" di web maupun mobile. Dipakai di semua titik poster acara
// pada lapisan publik: kartu beranda/daftar (EventCard), halaman
// detail (EventDetail), kartu rutin (Jadwal), dan arsip. Logo
// penyelenggara BUKAN poster dan tidak memakai komponen ini.
//
// Perilaku: tombol membungkus <img> poster dengan kelas dari
// pemanggil agar tampilan asal tidak berubah; klik membuka overlay
// (portal ke body) berisi gambar utuh object-contain. Popup ditutup
// lewat tombol ✕, klik latar, atau Escape; gulir body dikunci selama
// terbuka dan fokus dipindah ke tombol tutup lalu dikembalikan ke
// tombol pemicu saat tertutup.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PosterLightbox({
  src,
  alt,
  imgClassName,
  wrapperClassName,
}: {
  src: string;
  alt: string;
  /** Kelas untuk <img> kecil di dalam tombol (dari pemanggil). */
  imgClassName?: string;
  /** Kelas untuk tombol pembungkus (ukuran/posisi dari pemanggil). */
  wrapperClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Perbesar poster"
        className={`group relative block cursor-zoom-in ${wrapperClassName ?? ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={imgClassName} loading="lazy" />
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-[2px] bg-em/85 text-paper opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" />
            <line x1="10.5" y1="8" x2="10.5" y2="13" />
            <line x1="8" y1="10.5" x2="13" y2="10.5" />
          </svg>
        </span>
      </button>

      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
              onClick={close}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-[92vh] max-w-[94vw] object-contain"
                onClick={(event) => event.stopPropagation()}
              />
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Tutup"
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-[2px] bg-paper text-xl leading-none text-ink hover:bg-ivory"
              >
                ✕
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
