"use client";

// Mekanisme slot konteks rail Serambi (spec redesign §6; plan
// redesign Task 2): halaman membungkus konten khasnya (filter,
// pencarian, daftar mini) dengan komponen ini, dan konten itu tampil
// di rail pada desktop atau di bar bawah header pada mobile — sebagai
// SATU instance yang sama, bukan dua salinan.
//
// Cara kerja:
// - Sebelum hidrasi & tanpa JavaScript, children dirender di tempat
//   (aliran konten halaman) — form GET publik tetap tampil & berfungsi
//   penuh tanpa JS, persis seperti sebelum redesign.
// - Setelah mount, children dipindah lewat createPortal ke wadah
//   #rail-slot (viewport ≥1024px, lewat matchMedia) atau #bar-slot
//   (<1024px), dan berpindah wadah lagi setiap breakpoint berubah.
// Karena state form hidup di query string, pemindahan DOM ini tidak
// mengubah perilaku form sama sekali.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const DESKTOP_QUERY = "(min-width: 1024px)";

export function RailSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => {
      setTarget(
        document.getElementById(mq.matches ? "rail-slot" : "bar-slot"),
      );
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!target) {
    return <>{children}</>;
  }
  return createPortal(children, target);
}
