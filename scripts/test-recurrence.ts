import assert from "node:assert/strict";
import {
  computeOccurrences,
  describePattern,
} from "../src/lib/recurrence.ts";
import type {
  RoutineExceptionRecord,
  RoutineRecord,
} from "../src/lib/domain.ts";

type RoutineInput = Pick<
  RoutineRecord,
  | "pattern"
  | "startTime"
  | "endTime"
  | "effectiveFrom"
  | "effectiveTo"
  | "venueName"
  | "address"
>;

// Default: pengajian mingguan setiap Jumat (weekday 5) 19:30–21:00 WIB.
function makeRoutine(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    pattern: { kind: "weekly", weekday: 5 },
    startTime: "19:30",
    endTime: "21:00",
    effectiveFrom: null,
    effectiveTo: null,
    venueName: "Masjid Contoh",
    address: "Jl. Contoh No. 1",
    ...overrides,
  };
}

function makeException(
  overrides: Partial<RoutineExceptionRecord> & { date: string },
): RoutineExceptionRecord {
  return {
    id: "exc-1",
    routineId: "rutin-1",
    kind: "libur",
    note: null,
    overrideVenueName: null,
    overrideAddress: null,
    overrideStartTime: null,
    overrideDescription: null,
    createdAt: "2026-01-01T00:00:00+07:00",
    updatedAt: "2026-01-01T00:00:00+07:00",
    ...overrides,
  };
}

function dates(occs: ReturnType<typeof computeOccurrences>): string[] {
  return occs.map((o) => o.date);
}

// --- 1. Mingguan dasar -------------------------------------------------------
// Acuan Kamis 2026-10-08 10:00 WIB → Jumat 9, 16, 23 Okt 2026.
{
  const occs = computeOccurrences(
    makeRoutine(),
    [],
    "2026-10-08T10:00:00+07:00",
    3,
  );
  assert.deepEqual(dates(occs), ["2026-10-09", "2026-10-16", "2026-10-23"]);
  assert.equal(occs[0].startISO, "2026-10-09T19:30:00+07:00");
  assert.equal(occs[0].endISO, "2026-10-09T21:00:00+07:00");
  assert.equal(occs[0].startTime, "19:30");
  assert.equal(occs[0].venueName, "Masjid Contoh");
  assert.equal(occs[0].address, "Jl. Contoh No. 1");
  assert.equal(occs[0].isOngoing, false);
  assert.equal(occs[0].exceptionKind, null);
  assert.equal(occs[0].note, null);
}

// Kemunculan yang sudah selesai lebih awal di hari yang sama tidak tampil:
// acuan Jumat 22:00 (acara 19:30–21:00 sudah lewat) → berikutnya pekan depan.
{
  const occs = computeOccurrences(
    makeRoutine(),
    [],
    "2026-10-09T22:00:00+07:00",
    1,
  );
  assert.deepEqual(dates(occs), ["2026-10-16"]);
}

// --- 2. Libur: default dilewati & tidak dihitung -----------------------------
{
  const libur = makeException({ date: "2026-10-16", note: "Libur Lebaran" });

  const occs = computeOccurrences(
    makeRoutine(),
    [libur],
    "2026-10-08T10:00:00+07:00",
    3,
  );
  assert.deepEqual(dates(occs), ["2026-10-09", "2026-10-23", "2026-10-30"]);

  // includeSkipped:true → libur ikut tampil, bertanda, dan dihitung ke count.
  const withSkipped = computeOccurrences(
    makeRoutine(),
    [libur],
    "2026-10-08T10:00:00+07:00",
    3,
    { includeSkipped: true },
  );
  assert.deepEqual(dates(withSkipped), [
    "2026-10-09",
    "2026-10-16",
    "2026-10-23",
  ]);
  assert.equal(withSkipped[1].exceptionKind, "libur");
  assert.equal(withSkipped[1].note, "Libur Lebaran");
}

// --- 3. Edisi spesial: override jam & tempat ---------------------------------
{
  const spesial = makeException({
    date: "2026-10-16",
    kind: "edisi-spesial",
    note: "Edisi Spesial Maulid",
    overrideVenueName: "Lapangan Contoh",
    overrideAddress: "Jl. Lain No. 2",
    overrideStartTime: "20:00",
  });
  const occs = computeOccurrences(
    makeRoutine(),
    [spesial],
    "2026-10-08T10:00:00+07:00",
    2,
  );
  assert.deepEqual(dates(occs), ["2026-10-09", "2026-10-16"]);
  const sp = occs[1];
  assert.equal(sp.exceptionKind, "edisi-spesial");
  assert.equal(sp.note, "Edisi Spesial Maulid");
  assert.equal(sp.venueName, "Lapangan Contoh");
  assert.equal(sp.address, "Jl. Lain No. 2");
  assert.equal(sp.startTime, "20:00");
  assert.equal(sp.startISO, "2026-10-16T20:00:00+07:00");
  // endTime induk (21:00) tetap berlaku, kini sesudah overrideStartTime.
  assert.equal(sp.endISO, "2026-10-16T21:00:00+07:00");
}

// Tumpang tindih libur + edisi spesial di tanggal sama: edisi spesial menang
// (spec §13.2), walau libur tercantum lebih dulu.
{
  const libur = makeException({ date: "2026-10-16", note: "Libur" });
  const spesial = makeException({
    id: "exc-2",
    date: "2026-10-16",
    kind: "edisi-spesial",
    note: "Tetap jalan, edisi spesial",
  });
  const occs = computeOccurrences(
    makeRoutine(),
    [libur, spesial],
    "2026-10-08T10:00:00+07:00",
    2,
  );
  assert.deepEqual(dates(occs), ["2026-10-09", "2026-10-16"]);
  assert.equal(occs[1].exceptionKind, "edisi-spesial");
}

// --- 4. monthly-date: tanggal 31 dari acuan Februari --------------------------
// Feb 2026 hanya 28 hari & April 30 hari — keduanya DILEWATI, bukan digeser.
{
  const occs = computeOccurrences(
    makeRoutine({
      pattern: { kind: "monthly-date", dayOfMonth: 31 },
      startTime: "09:00",
      endTime: null,
    }),
    [],
    "2026-02-10T08:00:00+07:00",
    2,
  );
  assert.deepEqual(dates(occs), ["2026-03-31", "2026-05-31"]);
}

// --- 5. monthly-weekday: Sabtu ke-2 -------------------------------------------
// Okt 2026: Sabtu ke-2 = 10 Okt; Nov 2026: Sabtu ke-2 = 14 Nov.
{
  const occs = computeOccurrences(
    makeRoutine({
      pattern: { kind: "monthly-weekday", weekday: 6, weekOfMonth: 2 },
    }),
    [],
    "2026-10-01T08:00:00+07:00",
    2,
  );
  assert.deepEqual(dates(occs), ["2026-10-10", "2026-11-14"]);
}

// --- 6. monthly-weekday: Jumat terakhir ---------------------------------------
// Okt 2026 Jumat terakhir = 30 Okt; Nov 2026 = 27 Nov.
{
  const occs = computeOccurrences(
    makeRoutine({
      pattern: { kind: "monthly-weekday", weekday: 5, weekOfMonth: "last" },
    }),
    [],
    "2026-10-01T08:00:00+07:00",
    2,
  );
  assert.deepEqual(dates(occs), ["2026-10-30", "2026-11-27"]);
}

// --- 7. monthly-weekday: minggu ke-5 yang tidak ada ----------------------------
// Senin Feb 2026 hanya 4 kali (2/9/16/23) → loncat ke Senin ke-5 Maret: 30 Mar.
{
  const occs = computeOccurrences(
    makeRoutine({
      pattern: { kind: "monthly-weekday", weekday: 1, weekOfMonth: 5 },
    }),
    [],
    "2026-02-01T08:00:00+07:00",
    1,
  );
  assert.deepEqual(dates(occs), ["2026-03-30"]);
}

// --- 8. endTime lintas tengah malam → isOngoing --------------------------------
// Acara Jumat 20:00–01:00; acuan Sabtu 00:30 → kemunculan Jumat masih berjalan.
{
  const rutin = makeRoutine({ startTime: "20:00", endTime: "01:00" });

  const occs = computeOccurrences(rutin, [], "2026-10-10T00:30:00+07:00", 1);
  assert.equal(occs.length, 1);
  assert.equal(occs[0].date, "2026-10-09");
  assert.equal(occs[0].isOngoing, true);
  assert.equal(occs[0].startISO, "2026-10-09T20:00:00+07:00");
  assert.equal(occs[0].endISO, "2026-10-10T01:00:00+07:00");

  // Setelah 01:00 lewat, kemunculan Jumat itu hilang; berikutnya Jumat depan.
  const sesudah = computeOccurrences(
    rutin,
    [],
    "2026-10-10T02:00:00+07:00",
    1,
  );
  assert.deepEqual(dates(sesudah), ["2026-10-16"]);
  assert.equal(sesudah[0].isOngoing, false);
}

// --- 9. Tanpa endTime: berlangsung sampai 23:59 hari yang sama -----------------
{
  const rutin = makeRoutine({ endTime: null });
  const occs = computeOccurrences(rutin, [], "2026-10-09T21:00:00+07:00", 1);
  assert.equal(occs[0].date, "2026-10-09");
  assert.equal(occs[0].isOngoing, true);
  assert.equal(occs[0].endISO, "2026-10-09T23:59:00+07:00");
}

// --- 10. Batas effectiveFrom / effectiveTo --------------------------------------
{
  const rutin = makeRoutine({
    effectiveFrom: "2026-10-16",
    effectiveTo: "2026-10-23",
  });
  const occs = computeOccurrences(
    rutin,
    [],
    "2026-10-08T10:00:00+07:00",
    10,
  );
  // Jumat 9 Okt sebelum effectiveFrom; 30 Okt sesudah effectiveTo.
  assert.deepEqual(dates(occs), ["2026-10-16", "2026-10-23"]);
}

// --- 11. describePattern: pola dalam bahasa manusia ---------------------------
// Contoh terkunci: mingguan malam memakai kaidah hari kalender spec §6.3
// (Kamis malam = "malam Jumat"), bulanan minggu-ke, bulanan tanggal tetap.
{
  assert.equal(
    describePattern(
      { kind: "weekly", weekday: 4 },
      { startTime: "19:30" },
    ),
    "Setiap Kamis malam Jumat (ba'da Maghrib)",
  );
  // Tanpa jam malam: bentuk singkat spec §9.2 ("Setiap Jumat").
  assert.equal(describePattern({ kind: "weekly", weekday: 5 }), "Setiap Jumat");
  assert.equal(
    describePattern({ kind: "weekly", weekday: 5 }, { startTime: "09:00" }),
    "Setiap Jumat",
  );
  assert.equal(
    describePattern({ kind: "monthly-weekday", weekday: 5, weekOfMonth: 2 }),
    "Jumat ke-2 setiap bulan",
  );
  assert.equal(
    describePattern({
      kind: "monthly-weekday",
      weekday: 5,
      weekOfMonth: "last",
    }),
    "Jumat terakhir setiap bulan",
  );
  assert.equal(
    describePattern({ kind: "monthly-date", dayOfMonth: 15 }),
    "Tanggal 15 setiap bulan",
  );
}

console.log("test-recurrence: OK");
