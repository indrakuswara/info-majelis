// Hasilkan gambar Open Graph statis per kategori ke public/og/
// (plan Task 13; spec §11–§12): template SVG berwarna kategori dirender
// ke PNG 1200×630 memakai sharp. Dijalankan sekali; hasil PNG di-commit.
// Jalankan ulang hanya bila label/warna kategori berubah:
//   node scripts/make-og.ts

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { CATEGORIES } from "../src/lib/constants.ts";

/** Warna latar per kategori — cermin kelas fallback di CATEGORY_STYLES (spec §11). */
const OG_BACKGROUNDS: Record<string, string> = {
  maulid: "#047857",
  "tabligh-akbar": "#172554",
  kajian: "#0d9488",
  haul: "#92400e",
  istighosah: "#7e22ce",
  phbi: "#7f1d1d",
  ziarah: "#68785a",
  lainnya: "#525252",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function svgFor(label: string, background: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${background}"/>
  <circle cx="1060" cy="80" r="300" fill="#ffffff" opacity="0.07"/>
  <circle cx="120" cy="580" r="220" fill="#ffffff" opacity="0.05"/>
  <text x="80" y="150" font-family="sans-serif" font-size="34" letter-spacing="6" fill="#ffffff" opacity="0.85">INFO MAJELIS</text>
  <text x="80" y="320" font-family="sans-serif" font-size="88" font-weight="bold" fill="#ffffff">${escapeXml(label)}</text>
  <text x="80" y="400" font-family="sans-serif" font-size="36" fill="#ffffff" opacity="0.9">Jadwal maulid, tabligh akbar, kajian,</text>
  <text x="80" y="450" font-family="sans-serif" font-size="36" fill="#ffffff" opacity="0.9">dan acara majelis lainnya</text>
  <text x="80" y="560" font-family="sans-serif" font-size="28" fill="#ffffff" opacity="0.7">Bekasi Raya &amp; Jakarta Timur</text>
</svg>`;
}

const outDir = path.join(process.cwd(), "public", "og");
fs.mkdirSync(outDir, { recursive: true });

for (const category of CATEGORIES) {
  const background = OG_BACKGROUNDS[category.value];
  if (!background) throw new Error(`Warna OG belum diatur: ${category.value}`);
  const out = path.join(outDir, `${category.value}.png`);
  await sharp(Buffer.from(svgFor(category.label, background))).png().toFile(out);
  console.log(`og: ${out}`);
}
