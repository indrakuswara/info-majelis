// Pola ornamen bintang-8 (khatam) untuk shell Serambi (spec redesign
// §5.4): SVG inline yang dapat diulang sebagai ubin (tile), digambar
// dari dua persegi berotasi 45° satu sama lain. HANYA dipakai di rail
// dan footer konten — bagian isi situs tidak memakai ornamen.
//
// Murni presentasi: aria-hidden, tanpa interaksi. className dari
// pemanggil mengatur posisi & opacity (selalu rendah di atas zamrud).

import { useId } from "react";

export function Ornament({ className }: { className?: string }) {
  const rawId = useId();
  const patternId = `bintang8-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg aria-hidden="true" className={className} focusable="false">
      <defs>
        <pattern
          id={patternId}
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <rect x="12" y="12" width="24" height="24" />
            <rect
              x="12"
              y="12"
              width="24"
              height="24"
              transform="rotate(45 24 24)"
            />
            <circle cx="24" cy="24" r="2.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
