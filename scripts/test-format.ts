// Test unit format tanggal/jam publik (plan Task 11; spec §9.2, §13.1).
// Jalankan: node scripts/test-format.ts

import assert from "node:assert/strict";
import {
  addDaysISODate,
  formatJamRange,
  formatTanggal,
  relativeDayLabel,
  wibTodayISODate,
} from "../src/lib/format.ts";

// --- formatTanggal: tanggal kalender polos ---------------------------------
// 15 Oktober 2026 adalah hari Kamis.
assert.equal(formatTanggal("2026-10-15"), "Kamis, 15 Oktober 2026");
assert.equal(formatTanggal("2026-10-08"), "Kamis, 8 Oktober 2026");
assert.equal(formatTanggal("2027-01-01"), "Jumat, 1 Januari 2027");

// --- formatTanggal: ISO datetime malam WIB tidak bergeser hari -------------
// 23:30 WIB tetap tanggal 15 (bukan mundur/maju karena zona mesin).
assert.equal(
  formatTanggal("2026-10-15T23:30:00+07:00"),
  "Kamis, 15 Oktober 2026",
);
// 00:30 WIB dini hari tetap tanggal 16.
assert.equal(
  formatTanggal("2026-10-16T00:30:00+07:00"),
  "Jumat, 16 Oktober 2026",
);
// ISO dalam UTC: 18:30Z = 01:30 WIB keesokan harinya ⇒ 16 Oktober.
assert.equal(
  formatTanggal("2026-10-15T18:30:00.000Z"),
  "Jumat, 16 Oktober 2026",
);
// 16:59Z = 23:59 WIB ⇒ masih 15 Oktober.
assert.equal(
  formatTanggal("2026-10-15T16:59:00.000Z"),
  "Kamis, 15 Oktober 2026",
);

// --- formatJamRange ---------------------------------------------------------
assert.equal(formatJamRange("19:30", "21:00"), "19:30 – 21:00 WIB");
assert.equal(formatJamRange("19:30", null), "19:30 WIB – selesai");
assert.equal(formatJamRange("08:00", "08:00"), "08:00 – 08:00 WIB");

// --- relativeDayLabel -------------------------------------------------------
assert.equal(relativeDayLabel("2026-10-08", "2026-10-08"), "Hari ini");
assert.equal(relativeDayLabel("2026-10-09", "2026-10-08"), "Besok");
assert.equal(relativeDayLabel("2026-10-10", "2026-10-08"), "");
assert.equal(relativeDayLabel("2026-10-07", "2026-10-08"), "");
// Batas tengah malam lintas bulan & tahun.
assert.equal(relativeDayLabel("2026-11-01", "2026-10-31"), "Besok");
assert.equal(relativeDayLabel("2027-01-01", "2026-12-31"), "Besok");
assert.equal(relativeDayLabel("2026-10-31", "2026-10-31"), "Hari ini");

// --- addDaysISODate ---------------------------------------------------------
assert.equal(addDaysISODate("2026-10-08", 1), "2026-10-09");
assert.equal(addDaysISODate("2026-10-31", 1), "2026-11-01");
assert.equal(addDaysISODate("2026-12-31", 60), "2027-03-01");
assert.equal(addDaysISODate("2026-10-08", 0), "2026-10-08");

// --- wibTodayISODate --------------------------------------------------------
// 2026-10-08T17:30:00Z = 2026-10-09 00:30 WIB.
assert.equal(wibTodayISODate(new Date("2026-10-08T17:30:00.000Z")), "2026-10-09");
// 2026-10-08T16:59:00Z = 2026-10-08 23:59 WIB.
assert.equal(wibTodayISODate(new Date("2026-10-08T16:59:00.000Z")), "2026-10-08");

console.log("test-format: OK");
