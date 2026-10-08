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
 * Aksen warna tetap per kategori (spec §11) — satu-satunya tempat
 * pemetaan warna kategori untuk UI publik. Sejak polish arah Kalender
 * Dinding (Task 14), warna kategori TIDAK lagi dipakai sebagai blok
 * latar besar: ia tampil hemat sebagai warna teks label kategori kecil
 * berhuruf kapital dan titik penanda di sisinya.
 * Nilai adalah nama kelas Tailwind literal agar terdeteksi pemindai kelas.
 * `text` = warna teks label kategori (cukup gelap untuk terbaca di atas
 * kertas putih hangat); `dot` = warna titik kecil pendamping label.
 */
export const CATEGORY_STYLES: Record<
  Category,
  { text: string; dot: string }
> = {
  maulid: { text: "text-emerald-800", dot: "bg-emerald-700" },
  "tabligh-akbar": { text: "text-blue-900", dot: "bg-blue-950" },
  kajian: { text: "text-teal-800", dot: "bg-teal-600" },
  haul: { text: "text-amber-800", dot: "bg-amber-700" },
  istighosah: { text: "text-purple-800", dot: "bg-purple-700" },
  phbi: { text: "text-red-900", dot: "bg-red-900" },
  ziarah: { text: "text-[#3f4a36]", dot: "bg-[#68785a]" },
  lainnya: { text: "text-neutral-600", dot: "bg-neutral-500" },
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
