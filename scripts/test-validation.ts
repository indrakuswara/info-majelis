import assert from "node:assert/strict";
import {
  validateEventForPublish,
  validateMajelisForPublish,
  validateRoutineForPublish,
} from "../src/lib/validation.ts";
import type {
  EventRecord,
  MajelisRecord,
  RecurrencePattern,
  RoutineRecord,
} from "../src/lib/domain.ts";

function fields(missing: { field: string }[]): string[] {
  return missing.map((m) => m.field);
}

// --- Event: lengkap ⇒ tidak ada yang kurang ----------------------------------
const eventLengkap: Partial<EventRecord> = {
  title: "Maulid Akbar",
  category: "maulid",
  startDate: "2026-10-20",
  startTime: "19:30",
  venueName: "Masjid Agung",
  address: "Jl. Raya No. 1",
  city: "Kota Bekasi",
  district: "Bekasi Timur",
};
assert.deepEqual(validateEventForPublish(eventLengkap), []);

// --- Event: tanpa district & startTime ⇒ tepat dua MissingField --------------
// Urutan mengikuti urutan field spec §6.2: startTime sebelum district.
{
  const kurang: Partial<EventRecord> = { ...eventLengkap };
  delete kurang.district;
  delete kurang.startTime;
  assert.deepEqual(validateEventForPublish(kurang), [
    { field: "startTime", label: "Jam mulai" },
    { field: "district", label: "Kecamatan" },
  ]);
}

// --- Event: string kosong / hanya spasi = belum terisi ------------------------
{
  const kosong: Partial<EventRecord> = {
    ...eventLengkap,
    title: "   ",
    address: "",
  };
  assert.deepEqual(fields(validateEventForPublish(kosong)), [
    "title",
    "address",
  ]);
}

// --- Event: objek kosong ⇒ kedelapan field wajib, urut §6.2 ------------------
assert.deepEqual(fields(validateEventForPublish({})), [
  "title",
  "category",
  "startDate",
  "startTime",
  "venueName",
  "address",
  "city",
  "district",
]);

// --- Rutin: lengkap (mingguan) ⇒ [] -------------------------------------------
const rutinLengkap: Partial<RoutineRecord> = {
  title: "Pengajian Rutin Jumat",
  category: "kajian",
  pattern: { kind: "weekly", weekday: 5 },
  startTime: "19:30",
  venueName: "Masjid Agung",
  address: "Jl. Raya No. 1",
  city: "Kota Bekasi",
  district: "Bekasi Timur",
};
assert.deepEqual(validateRoutineForPublish(rutinLengkap), []);

// --- Rutin: monthly-date tanpa dayOfMonth ⇒ pattern kurang ---------------------
{
  const tanpaTanggal: Partial<RoutineRecord> = {
    ...rutinLengkap,
    pattern: { kind: "monthly-date" } as unknown as RecurrencePattern,
  };
  assert.deepEqual(validateRoutineForPublish(tanpaTanggal), [
    { field: "pattern", label: "Pola pengulangan" },
  ]);
}

// --- Rutin: dayOfMonth di luar 1–31 ⇒ pattern kurang ---------------------------
for (const dayOfMonth of [0, 32]) {
  const rutin: Partial<RoutineRecord> = {
    ...rutinLengkap,
    pattern: { kind: "monthly-date", dayOfMonth },
  };
  assert.deepEqual(fields(validateRoutineForPublish(rutin)), ["pattern"]);
}

// --- Rutin: pola lengkap per kind ⇒ tidak kurang -------------------------------
{
  const tanggalTetap: Partial<RoutineRecord> = {
    ...rutinLengkap,
    pattern: { kind: "monthly-date", dayOfMonth: 15 },
  };
  assert.deepEqual(validateRoutineForPublish(tanggalTetap), []);

  const mingguKe: Partial<RoutineRecord> = {
    ...rutinLengkap,
    pattern: { kind: "monthly-weekday", weekday: 6, weekOfMonth: 2 },
  };
  assert.deepEqual(validateRoutineForPublish(mingguKe), []);

  const mingguTerakhir: Partial<RoutineRecord> = {
    ...rutinLengkap,
    pattern: { kind: "monthly-weekday", weekday: 5, weekOfMonth: "last" },
  };
  assert.deepEqual(validateRoutineForPublish(mingguTerakhir), []);
}

// --- Rutin: weekly tanpa weekday & monthly-weekday tanpa weekOfMonth -----------
{
  const tanpaHari: Partial<RoutineRecord> = {
    ...rutinLengkap,
    pattern: { kind: "weekly" } as unknown as RecurrencePattern,
  };
  assert.deepEqual(fields(validateRoutineForPublish(tanpaHari)), ["pattern"]);

  const tanpaMingguKe: Partial<RoutineRecord> = {
    ...rutinLengkap,
    pattern: {
      kind: "monthly-weekday",
      weekday: 6,
    } as unknown as RecurrencePattern,
  };
  assert.deepEqual(fields(validateRoutineForPublish(tanpaMingguKe)), [
    "pattern",
  ]);
}

// --- Rutin: tanpa pola sama sekali & field lain kurang -------------------------
{
  const kosong: Partial<RoutineRecord> = { title: "Pengajian" };
  assert.deepEqual(fields(validateRoutineForPublish(kosong)), [
    "category",
    "pattern",
    "startTime",
    "venueName",
    "address",
    "city",
    "district",
  ]);
}

// --- Majelis: lengkap ⇒ []; kosong ⇒ name + majelisCity -------------------------
{
  const lengkap: Partial<MajelisRecord> = {
    name: "Majelis Contoh",
    city: "Kota Bekasi",
  };
  assert.deepEqual(validateMajelisForPublish(lengkap), []);

  assert.deepEqual(validateMajelisForPublish({}), [
    { field: "name", label: "Nama majelis" },
    { field: "majelisCity", label: "Kota/Kabupaten basis" },
  ]);

  const namaSpasi: Partial<MajelisRecord> = { name: "  ", city: "Kota Bekasi" };
  assert.deepEqual(fields(validateMajelisForPublish(namaSpasi)), ["name"]);
}

console.log("test-validation: OK");
