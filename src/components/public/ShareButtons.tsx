"use client";

// Tombol Bagikan (spec §10) — salah satu dari HANYA dua tombol aksi di
// halaman detail (tidak ada tombol kalender dalam bentuk apa pun).
// Jalur utama: Web Share API bila perangkat mendukung. Fallback: menu
// WhatsApp (teks siap kirim dari buildShareText) & Salin Tautan dengan
// umpan balik "Tautan disalin".

import { useEffect, useRef, useState } from "react";

export function ShareButtons({
  title,
  text,
  url,
}: {
  title: string;
  /** Teks siap kirim format spec §10 (sudah memuat URL detail). */
  text: string;
  /** URL kanonis halaman ini untuk Salin Tautan. */
  url: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  function showFeedback(message: string) {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  }

  async function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        // Teks spec §10 sudah memuat URL ("Detail: ..."), jadi url tidak
        // dikirim terpisah agar tautan tidak muncul dua kali di target.
        await navigator.share({ title, text });
        return;
      } catch (error) {
        // Batal oleh pengguna ⇒ jangan paksa tampilkan menu fallback.
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    setMenuOpen((open) => !open);
  }

  async function handleCopy() {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(url);
      showFeedback("Tautan disalin");
      return;
    } catch {
      // Clipboard API tidak tersedia/ditolak — coba cara lama.
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      showFeedback(
        ok ? "Tautan disalin" : "Tidak dapat menyalin tautan otomatis",
      );
    } catch {
      showFeedback("Tidak dapat menyalin tautan otomatis");
    }
  }

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={handleShare}
        aria-expanded={menuOpen}
        className="inline-flex w-full items-center justify-center rounded-[2px] border border-em px-5 py-3 text-sm font-bold text-em hover:bg-ivory"
      >
        Bagikan
      </button>

      {/* Menu selalu dirender (tersembunyi sampai dibuka) agar tautan
          WhatsApp ikut hadir pada HTML awal. */}
      <div
        className={`absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-[2px] border border-line bg-paper ${
          menuOpen ? "" : "hidden"
        }`}
      >
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-3 text-sm font-medium text-ink hover:bg-ivory"
        >
          Bagikan via WhatsApp
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="block w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-ivory"
        >
          Salin Tautan
        </button>
      </div>

      {feedback ? (
        <p
          role="status"
          className="absolute inset-x-0 top-full z-10 mt-2 rounded-[2px] bg-em px-4 py-2 text-center text-sm font-medium text-paper"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
