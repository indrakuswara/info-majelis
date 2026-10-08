// Hasilkan ikon PWA (PNG) dari motif SVG geometris kubah + bulan sabit
// (plan Task 14; spec §12): dirender memakai sharp ke public/icons/ dan
// public/apple-touch-icon.png. Dijalankan sekali; hasil PNG di-commit.
// Motif identik dengan public/icons/icon.svg (sumber SVG statis yang
// dilayani situs); varian maskable memakai motif yang sama diperkecil ke
// zona aman (safe zone) dengan latar penuh tanpa sudut membulat.
// Jalankan ulang hanya bila motif/warna berubah:
//   node scripts/make-icons.ts

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BACKGROUND = "#064e3b";

/** Motif kubah geometris (grup SVG, kanvas 512×512) — tanpa teks. */
const MOTIF = `
  <g transform="translate(0 10)">
    <circle cx="256" cy="102" r="28" fill="#fafaf9"/>
    <circle cx="269" cy="94" r="23" fill="${BACKGROUND}"/>
    <rect x="252" y="126" width="8" height="26" fill="#fafaf9"/>
    <path d="M256 148 C306 208 352 246 352 330 L352 360 L160 360 L160 330 C160 246 206 208 256 148 Z" fill="#fafaf9"/>
    <path d="M228 360 L228 316 Q256 288 284 316 L284 360 Z" fill="${BACKGROUND}"/>
    <rect x="146" y="360" width="220" height="16" fill="#fafaf9"/>
    <rect x="132" y="384" width="248" height="14" fill="#e7e5e4"/>
    <rect x="112" y="406" width="288" height="10" rx="5" fill="#fafaf9" opacity="0.5"/>
  </g>`;

function svgNormal(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BACKGROUND}"/>${MOTIF}
</svg>`;
}

function svgMaskable(): string {
  // Motif diperkecil ke ±72% di tengah kanvas agar seluruh motif berada
  // di dalam zona aman maskable (lingkaran 80% di tengah).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BACKGROUND}"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">${MOTIF}
  </g>
</svg>`;
}

async function render(svg: string, size: number, outPath: string) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`ok ${path.relative(process.cwd(), outPath)} (${size}×${size})`);
}

const iconsDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

await render(svgNormal(), 192, path.join(iconsDir, "icon-192.png"));
await render(svgNormal(), 512, path.join(iconsDir, "icon-512.png"));
await render(svgMaskable(), 192, path.join(iconsDir, "icon-maskable-192.png"));
await render(svgMaskable(), 512, path.join(iconsDir, "icon-maskable-512.png"));
await render(
  svgNormal(),
  180,
  path.join(process.cwd(), "public", "apple-touch-icon.png"),
);
