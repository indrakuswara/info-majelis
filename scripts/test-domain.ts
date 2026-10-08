import assert from "node:assert/strict";
import { CATEGORIES, REGIONS } from "../src/lib/constants.ts";
import { slugify, uniqueSlug } from "../src/lib/slug.ts";

// Konstanta terkunci spec §6.1: 8 kategori, 14 wilayah
assert.equal(CATEGORIES.length, 8, "CATEGORIES harus berisi tepat 8 kategori");
assert.equal(REGIONS.length, 14, "REGIONS harus berisi tepat 14 wilayah");

// slugify: huruf kecil, non-alfanumerik jadi satu '-', tanpa '-' di tepi
assert.equal(
  slugify("Maulid Akbar & Haul ke-10!"),
  "maulid-akbar-haul-ke-10",
);

// uniqueSlug: sufiks -2, -3, ... bila nama sudah dipakai
assert.equal(uniqueSlug("maulid", new Set(["maulid"])), "maulid-2");

console.log("test-domain: OK");
