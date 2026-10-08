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

/**
 * Kelas warna tetap per kategori (spec §11) — satu-satunya tempat pemetaan
 * warna kategori untuk UI publik: latar blok fallback kartu & chip label.
 * Nilai adalah nama kelas Tailwind literal agar terdeteksi pemindai kelas.
 * `fallback` = latar blok tanpa poster (teks putih di atasnya);
 * `chip` = label kategori kecil di kartu.
 */
export const CATEGORY_STYLES: Record<
  Category,
  { fallback: string; chip: string }
> = {
  maulid: { fallback: "bg-emerald-700", chip: "bg-emerald-100 text-emerald-900" },
  "tabligh-akbar": { fallback: "bg-blue-950", chip: "bg-blue-100 text-blue-950" },
  kajian: { fallback: "bg-teal-600", chip: "bg-teal-100 text-teal-900" },
  haul: { fallback: "bg-amber-800", chip: "bg-amber-100 text-amber-900" },
  istighosah: { fallback: "bg-purple-700", chip: "bg-purple-100 text-purple-900" },
  phbi: { fallback: "bg-red-900", chip: "bg-red-100 text-red-900" },
  ziarah: { fallback: "bg-[#68785a]", chip: "bg-[#e6ebdf] text-[#3f4a36]" },
  lainnya: { fallback: "bg-neutral-600", chip: "bg-neutral-200 text-neutral-800" },
};

/** Label kategori dari nilai kategorinya; "Lainnya" bila tak dikenal. */
export function categoryLabel(value: Category): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "Lainnya";
}

/**
 * Keterangan cakupan isi saat ini yang tampil transparan di beranda &
 * footer (spec §5/§9.1) — diatur lewat konstanta ini, bukan CMS.
 */
export const SITE_COVERAGE_NOTE =
  "Saat ini memuat acara di Bekasi Raya & Jakarta Timur — wilayah lain menyusul.";

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
