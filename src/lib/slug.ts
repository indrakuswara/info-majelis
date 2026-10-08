/**
 * Membuat slug URL dari teks bebas: huruf kecil, diakritik dibuang,
 * apostrof dibuang agar kata transliterasi menyatu (Diba'i → dibai),
 * setiap rangkaian karakter non-alfanumerik lain menjadi satu "-",
 * tanpa "-" di awal/akhir.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Mengembalikan base bila belum dipakai; bila sudah, menambahkan
 * sufiks "-2", "-3", ... sampai menemukan yang bebas.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
