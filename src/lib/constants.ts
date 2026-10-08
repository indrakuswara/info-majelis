import type { Category } from "./domain.ts";

/**
 * Kategori terkunci spec §6.1 (urutan sesuai spec).
 * colorToken mengikuti pemetaan warna spec §11:
 * Maulid = hijau zamrud, Tabligh Akbar = biru tua, Kajian = toska,
 * Haul = cokelat keemasan, Istighosah = ungu, PHBI = merah marun,
 * Ziarah = abu kehijauan (sage), Lainnya = abu netral.
 * (Pemetaan warna final dikunci pada fase desain visual — spec §11.)
 */
export const CATEGORIES: { value: Category; label: string; colorToken: string }[] = [
  { value: "maulid", label: "Maulid", colorToken: "emerald" },
  { value: "tabligh-akbar", label: "Tabligh Akbar", colorToken: "navy" },
  { value: "kajian", label: "Kajian / Pengajian", colorToken: "teal" },
  { value: "haul", label: "Haul", colorToken: "golden-brown" },
  { value: "istighosah", label: "Istighosah & Doa Bersama", colorToken: "purple" },
  { value: "phbi", label: "PHBI", colorToken: "maroon" },
  { value: "ziarah", label: "Ziarah", colorToken: "sage" },
  { value: "lainnya", label: "Lainnya", colorToken: "neutral-gray" },
];

/** Wilayah filter terkunci spec §6.1 (14 kota/kabupaten, urutan sesuai spec). */
export const REGIONS: string[] = [
  "Jakarta Pusat",
  "Jakarta Barat",
  "Jakarta Timur",
  "Jakarta Selatan",
  "Jakarta Utara",
  "Kepulauan Seribu",
  "Kota Bogor",
  "Kabupaten Bogor",
  "Kota Depok",
  "Kota Tangerang",
  "Kabupaten Tangerang",
  "Kota Tangerang Selatan",
  "Kota Bekasi",
  "Kabupaten Bekasi",
];
