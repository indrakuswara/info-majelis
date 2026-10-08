import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Pakai SQLite TEMP terpisah — jangan pernah menyentuh .data dev.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "info-majelis-test-"));
process.env.INFO_MAJELIS_DB_PATH = path.join(tmpDir, "test.db");
delete process.env.DATABASE_URL;

const db = await import("../src/lib/db.ts");
import type {
  EventRecord,
  MajelisRecord,
  RoutineRecord,
} from "../src/lib/domain.ts";

type EventInput = Parameters<typeof db.createEvent>[0];
type RoutineInput = Parameters<typeof db.createRoutine>[0];
type MajelisInput = Parameters<typeof db.createMajelis>[0];

const NOW = "2026-10-08T12:00:00+07:00"; // Kamis 8 Okt 2026, tengah hari WIB

function makeMajelisInput(
  overrides: Partial<MajelisInput> = {},
): MajelisInput {
  return {
    name: "Majelis Nurul Iman",
    city: "Kota Bekasi",
    leader: "Habib Contoh",
    logoUrl: null,
    photoUrl: null,
    baseAddress: "Jl. Markas No. 1",
    baseDistrict: "Bekasi Timur",
    baseMapsUrl: null,
    description: "Profil contoh",
    instagramUrl: null,
    youtubeUrl: null,
    tiktokUrl: null,
    websiteUrl: null,
    contact: null,
    status: "published",
    createdBy: "admin@test",
    ...overrides,
  };
}

function makeEventInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    title: "Maulid Akbar Contoh",
    category: "maulid",
    startDate: "2026-10-20",
    endDate: null,
    startTime: "19:30",
    endTime: "21:00",
    venueName: "Masjid Contoh",
    address: "Jl. Contoh No. 1",
    city: "Kota Bekasi",
    district: "Bekasi Timur",
    mapsUrl: null,
    lat: null,
    lng: null,
    description: "Deskripsi contoh",
    posterUrl: null,
    organizerMajelisId: null,
    organizerNameManual: null,
    speakers: ["Habib Contoh"],
    audience: "umum",
    liveStreamUrl: null,
    contact: null,
    extraInfo: null,
    libraryUrl: null,
    sourceInfo: "sumber-rahasia-xyz",
    status: "published",
    createdBy: "admin@test",
    ...overrides,
  };
}

function makeRoutineInput(
  overrides: Partial<RoutineInput> = {},
): RoutineInput {
  return {
    title: "Pengajian Jumat Malam",
    category: "kajian",
    pattern: { kind: "weekly", weekday: 5 },
    startTime: "19:30",
    endTime: "21:00",
    effectiveFrom: null,
    effectiveTo: null,
    specialNote: null,
    isActive: true,
    venueName: "Masjid Contoh",
    address: "Jl. Contoh No. 1",
    city: "Kota Bekasi",
    district: "Bekasi Timur",
    mapsUrl: null,
    lat: null,
    lng: null,
    description: "Rutin contoh",
    posterUrl: null,
    organizerMajelisId: null,
    organizerNameManual: null,
    speakers: ["Ustadz Contoh"],
    audience: "umum",
    liveStreamUrl: null,
    contact: null,
    extraInfo: null,
    libraryUrl: null,
    sourceInfo: "sumber-rutin-rahasia",
    status: "published",
    createdBy: "admin@test",
    ...overrides,
  };
}

await db.ensureSchema();

// --- 0. Tabel admins ikut dibuat ensureSchema (dipakai Task 5) ---------------
{
  const raw = new DatabaseSync(path.join(tmpDir, "test.db"));
  const row = raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='admins'",
    )
    .get() as { name: string } | undefined;
  assert.equal(row?.name, "admins");
  raw.close();
}

// --- 1. Majelis: CRUD + slug unik + published-only ----------------------------
let majelis: MajelisRecord;
{
  majelis = await db.createMajelis(makeMajelisInput());
  assert.equal(majelis.slug, "majelis-nurul-iman");
  assert.equal(majelis.createdBy, "admin@test");
  assert.ok(majelis.id.length > 0);
  assert.ok(majelis.createdAt.length > 0);

  const duplikat = await db.createMajelis(makeMajelisInput());
  assert.equal(duplikat.slug, "majelis-nurul-iman-2");

  const draft = await db.createMajelis(
    makeMajelisInput({ name: "Majelis Draft Saja", status: "draft" }),
  );
  assert.equal(draft.status, "draft");

  // Publik: hanya published.
  const publik = await db.listPublishedMajelis({});
  assert.ok(publik.some((m) => m.id === majelis.id));
  assert.ok(!publik.some((m) => m.id === draft.id));
  assert.equal(
    (await db.getPublishedMajelisBySlug(draft.slug))?.id ?? null,
    null,
  );
  assert.equal(
    (await db.getPublishedMajelisBySlug(majelis.slug))?.id,
    majelis.id,
  );
  assert.equal(
    (await db.listPublishedMajelis({ city: "Jakarta Timur" })).length,
    0,
  );

  // Admin: filter status & q menemukan draft.
  const adminDraft = await db.listAdminMajelis({ status: "draft" });
  assert.ok(adminDraft.some((m) => m.id === draft.id));
  const adminQ = await db.listAdminMajelis({ q: "draft saja" });
  assert.ok(adminQ.some((m) => m.id === draft.id));

  // Update tidak mengganti slug walau nama berubah.
  const updated = await db.updateMajelis(majelis.id, {
    name: "Majelis Nurul Iman Raya",
  });
  assert.equal(updated?.name, "Majelis Nurul Iman Raya");
  assert.equal(updated?.slug, "majelis-nurul-iman");
}

// --- 2. Event: CRUD + upcoming menyembunyikan draft & yang lewat -------------
let eventUtama: EventRecord;
{
  eventUtama = await db.createEvent(makeEventInput());
  assert.equal(eventUtama.slug, "maulid-akbar-contoh");
  assert.equal(eventUtama.createdBy, "admin@test");
  assert.deepEqual(eventUtama.speakers, ["Habib Contoh"]);

  const draft = await db.createEvent(
    makeEventInput({ title: "Event Draft Rahasia", status: "draft" }),
  );
  const lewat = await db.createEvent(
    makeEventInput({
      title: "Event Kemarin Lewat",
      startDate: "2026-10-07",
      endDate: null,
      startTime: "19:00",
      endTime: "21:00",
    }),
  );
  // Multi-hari sedang berjalan: mulai kemarin, selesai besok.
  const multiHari = await db.createEvent(
    makeEventInput({
      title: "Event Multi Hari Berjalan",
      startDate: "2026-10-07",
      endDate: "2026-10-09",
      startTime: "09:00",
      endTime: "17:00",
    }),
  );
  // Lintas tengah malam: hari ini 20:00–01:00.
  const lintasMalam = await db.createEvent(
    makeEventInput({
      title: "Event Lintas Malam",
      startDate: "2026-10-08",
      endDate: null,
      startTime: "20:00",
      endTime: "01:00",
    }),
  );

  const upcoming = await db.listPublishedUpcoming({ nowISO: NOW });
  const upcomingIds = upcoming.map((e) => e.id);
  assert.ok(upcomingIds.includes(eventUtama.id));
  assert.ok(!upcomingIds.includes(draft.id), "draft bocor ke upcoming");
  assert.ok(!upcomingIds.includes(lewat.id), "event lewat bocor ke upcoming");
  assert.ok(upcomingIds.includes(multiHari.id));
  assert.ok(upcomingIds.includes(lintasMalam.id));
  // Terurut mulai menaik.
  const starts = upcoming.map((e) => `${e.startDate}T${e.startTime}`);
  assert.deepEqual(starts, [...starts].sort());

  // Lintas malam masih tampil pada 00:30 keesokan hari, hilang setelah 01:00.
  const diniHari = await db.listPublishedUpcoming({
    nowISO: "2026-10-09T00:30:00+07:00",
  });
  assert.ok(diniHari.some((e) => e.id === lintasMalam.id));
  const setelahSelesai = await db.listPublishedUpcoming({
    nowISO: "2026-10-09T02:00:00+07:00",
  });
  assert.ok(!setelahSelesai.some((e) => e.id === lintasMalam.id));

  // Arsip: hanya yang sudah lewat & published.
  const arsip = await db.listPublishedArchive({});
  assert.ok(arsip.some((e) => e.id === lewat.id));
  assert.ok(!arsip.some((e) => e.id === eventUtama.id));
  assert.ok(!arsip.some((e) => e.id === draft.id));

  // Filter upcoming: kota/kategori/kecamatan.
  assert.ok(
    (await db.listPublishedUpcoming({ nowISO: NOW, city: "Kota Bekasi" }))
      .length >= 3,
  );
  assert.equal(
    (await db.listPublishedUpcoming({ nowISO: NOW, city: "Kota Depok" }))
      .length,
    0,
  );
  assert.equal(
    (
      await db.listPublishedUpcoming({
        nowISO: NOW,
        district: "Tidak Ada",
      })
    ).length,
    0,
  );

  // Range: hari ini / minggu ini / weekend.
  const hariIni = await db.listPublishedUpcoming({
    nowISO: NOW,
    range: "today",
  });
  assert.ok(hariIni.some((e) => e.id === lintasMalam.id));
  assert.ok(!hariIni.some((e) => e.id === eventUtama.id)); // 20 Okt bukan hari ini
  const weekend = await db.listPublishedUpcoming({
    nowISO: NOW,
    range: "weekend",
  });
  assert.ok(!weekend.some((e) => e.id === eventUtama.id));
  const sabtu = await db.createEvent(
    makeEventInput({
      title: "Event Sabtu Weekend",
      startDate: "2026-10-10",
      startTime: "09:00",
      endTime: "11:00",
    }),
  );
  const weekend2 = await db.listPublishedUpcoming({
    nowISO: NOW,
    range: "weekend",
  });
  assert.ok(weekend2.some((e) => e.id === sabtu.id));
}

// --- 3. Search publik: published saja & sourceInfo tidak bocor ----------------
{
  const draftUnik = await db.createEvent(
    makeEventInput({
      title: "Katakunci Draft Unik Zebra",
      status: "draft",
      startDate: "2026-11-01",
    }),
  );
  assert.equal(
    (await db.searchPublishedEvents("zebra", {})).length,
    0,
    "search publik menemukan draft",
  );
  // Kata yang HANYA ada di sourceInfo tidak boleh menemukan event terbit.
  assert.equal(
    (await db.searchPublishedEvents("sumber-rahasia-xyz", {})).length,
    0,
    "search publik mencari ke sourceInfo",
  );
  // Admin tetap menemukan draft-nya.
  assert.ok(
    (await db.listAdminEvents({ q: "zebra" })).some(
      (e) => e.id === draftUnik.id,
    ),
  );
  // Search menurut penceramah, tempat, kecamatan.
  assert.ok(
    (await db.searchPublishedEvents("habib contoh", {})).some(
      (e) => e.id === eventUtama.id,
    ),
  );
  assert.ok(
    (await db.searchPublishedEvents("masjid contoh", {})).some(
      (e) => e.id === eventUtama.id,
    ),
  );
  // Hasil search & slug publik: sourceInfo selalu null.
  const viaSlug = await db.getPublishedEventBySlug(eventUtama.slug);
  assert.equal(viaSlug?.id, eventUtama.id);
  assert.equal(viaSlug?.sourceInfo, null);
  const viaSearch = await db.searchPublishedEvents("maulid akbar contoh", {});
  assert.ok(viaSearch.length >= 1);
  assert.ok(viaSearch.every((e) => e.sourceInfo === null));
  const viaUpcoming = await db.listPublishedUpcoming({ nowISO: NOW });
  assert.ok(viaUpcoming.every((e) => e.sourceInfo === null));
  // Sedangkan admin melihat sourceInfo asli.
  const viaAdmin = await db.getEventById(eventUtama.id);
  assert.equal(viaAdmin?.sourceInfo, "sumber-rahasia-xyz");
}

// --- 4. Rutin: CRUD + published/active + pola JSON utuh ------------------------
let rutin: RoutineRecord;
{
  rutin = await db.createRoutine(makeRoutineInput());
  assert.equal(rutin.slug, "pengajian-jumat-malam");
  assert.deepEqual(rutin.pattern, { kind: "weekly", weekday: 5 });
  assert.deepEqual(rutin.speakers, ["Ustadz Contoh"]);

  const nonaktif = await db.createRoutine(
    makeRoutineInput({ title: "Rutin Nonaktif", isActive: false }),
  );
  const draftRutin = await db.createRoutine(
    makeRoutineInput({ title: "Rutin Draft", status: "draft" }),
  );

  const publik = await db.listPublishedRoutines({});
  assert.ok(publik.some((r) => r.id === rutin.id));
  assert.ok(!publik.some((r) => r.id === nonaktif.id));
  assert.ok(!publik.some((r) => r.id === draftRutin.id));
  assert.ok(publik.every((r) => r.sourceInfo === null));
  assert.equal(
    (await db.getPublishedRoutineBySlug(draftRutin.slug))?.id ?? null,
    null,
  );

  // Filter weekday: rutin Jumat (5) cocok; Rabu (3) tidak.
  assert.ok(
    (await db.listPublishedRoutines({ weekday: 5 })).some(
      (r) => r.id === rutin.id,
    ),
  );
  assert.equal(
    (await db.listPublishedRoutines({ weekday: 3 })).length,
    0,
  );

  // Toggle aktif.
  const off = await db.setRoutineActive(rutin.id, false);
  assert.equal(off?.isActive, false);
  assert.ok(
    !(await db.listPublishedRoutines({})).some((r) => r.id === rutin.id),
  );
  const on = await db.setRoutineActive(rutin.id, true);
  assert.equal(on?.isActive, true);
}

// --- 5. Pengecualian: pola, tunggal per tanggal, cascade ----------------------
{
  // Jumat 2026-10-09 adalah kemunculan sah pola weekly Jumat.
  const exc = await db.createRoutineException({
    routineId: rutin.id,
    date: "2026-10-09",
    kind: "libur",
    note: "Libur Lebaran",
    overrideVenueName: null,
    overrideAddress: null,
    overrideStartTime: null,
    overrideDescription: null,
  });
  assert.equal(exc.routineId, rutin.id);

  // Tanggal yang BUKAN hasil pola (Sabtu 2026-10-10) ditolak.
  await assert.rejects(
    db.createRoutineException({
      routineId: rutin.id,
      date: "2026-10-10",
      kind: "libur",
      note: null,
      overrideVenueName: null,
      overrideAddress: null,
      overrideStartTime: null,
      overrideDescription: null,
    }),
    Error,
  );
  // Tanggal sama dua kali ditolak (satu tanggal maksimal satu pengecualian).
  await assert.rejects(
    db.createRoutineException({
      routineId: rutin.id,
      date: "2026-10-09",
      kind: "edisi-spesial",
      note: null,
      overrideVenueName: null,
      overrideAddress: null,
      overrideStartTime: null,
      overrideDescription: null,
    }),
    Error,
  );

  const daftar = await db.listRoutineExceptions(rutin.id);
  assert.equal(daftar.length, 1);

  // Update ke Jumat sah lain (16 Okt) berhasil.
  const dipindah = await db.updateRoutineException(exc.id, {
    date: "2026-10-16",
  });
  assert.equal(dipindah?.date, "2026-10-16");

  // Hapus rutin ⇒ pengecualiannya ikut terhapus.
  const rutinLain = await db.createRoutine(
    makeRoutineInput({ title: "Rutin Untuk Dihapus" }),
  );
  await db.createRoutineException({
    routineId: rutinLain.id,
    date: "2026-10-09",
    kind: "libur",
    note: null,
    overrideVenueName: null,
    overrideAddress: null,
    overrideStartTime: null,
    overrideDescription: null,
  });
  await db.deleteRoutine(rutinLain.id);
  assert.equal((await db.listRoutineExceptions(rutinLain.id)).length, 0);
  assert.equal(await db.getRoutineById(rutinLain.id), null);
}

// --- 6. deleteMajelis men-null-kan hubungan, event/rutin tetap ada ------------
{
  const target = await db.createMajelis(
    makeMajelisInput({ name: "Majelis Akan Dihapus" }),
  );
  const ev = await db.createEvent(
    makeEventInput({
      title: "Event Milik Majelis Hapus",
      organizerMajelisId: target.id,
      startDate: "2026-11-05",
    }),
  );
  const rt = await db.createRoutine(
    makeRoutineInput({
      title: "Rutin Milik Majelis Hapus",
      organizerMajelisId: target.id,
    }),
  );
  await db.deleteMajelis(target.id);
  assert.equal(await db.getMajelisById(target.id), null);
  const evAfter = await db.getEventById(ev.id);
  assert.ok(evAfter, "event ikut terhapus saat majelis dihapus");
  assert.equal(evAfter?.organizerMajelisId, null);
  const rtAfter = await db.getRoutineById(rt.id);
  assert.ok(rtAfter, "rutin ikut terhapus saat majelis dihapus");
  assert.equal(rtAfter?.organizerMajelisId, null);
}

// --- 7. Nama manual: daftar grup + promosi --------------------------------------
{
  const namaManual = "Panitia Al-Ikhlas";
  const e1 = await db.createEvent(
    makeEventInput({
      title: "Event Manual Satu",
      organizerNameManual: namaManual,
      startDate: "2026-11-10",
    }),
  );
  const e2 = await db.createEvent(
    makeEventInput({
      title: "Event Manual Dua",
      organizerNameManual: namaManual,
      startDate: "2026-11-12",
    }),
  );
  const r1 = await db.createRoutine(
    makeRoutineInput({
      title: "Rutin Manual Satu",
      organizerNameManual: namaManual,
    }),
  );
  // Nama sama tapi kota berbeda — grup terpisah, tidak ikut terpromosi.
  const eLainKota = await db.createEvent(
    makeEventInput({
      title: "Event Manual Kota Lain",
      organizerNameManual: namaManual,
      city: "Jakarta Timur",
      district: "Cakung",
      startDate: "2026-11-15",
    }),
  );

  const grup = await db.listManualOrganizerNames();
  const grupBekasi = grup.find(
    (g) => g.name === namaManual && g.city === "Kota Bekasi",
  );
  assert.ok(grupBekasi);
  assert.equal(grupBekasi?.eventCount, 2);
  assert.equal(grupBekasi?.routineCount, 1);

  const hasil = await db.promoteManualOrganizer(namaManual, "Kota Bekasi");
  assert.equal(hasil.linkedEvents, 2);
  assert.equal(hasil.linkedRoutines, 1);
  assert.equal(hasil.majelis.name, namaManual);
  assert.equal(hasil.majelis.city, "Kota Bekasi");

  for (const id of [e1.id, e2.id]) {
    const after = await db.getEventById(id);
    assert.equal(after?.organizerMajelisId, hasil.majelis.id);
    assert.equal(after?.organizerNameManual, null);
  }
  const rAfter = await db.getRoutineById(r1.id);
  assert.equal(rAfter?.organizerMajelisId, hasil.majelis.id);
  const lainKotaAfter = await db.getEventById(eLainKota.id);
  assert.equal(lainKotaAfter?.organizerMajelisId, null);
  assert.equal(lainKotaAfter?.organizerNameManual, namaManual);

  // Search publik menemukan event lewat nama majelis hasil promosi.
  assert.ok(
    (await db.searchPublishedEvents("al-ikhlas", {})).some(
      (e) => e.id === e1.id,
    ),
  );
}

// --- 8. listKnownDistricts -------------------------------------------------------
{
  const districts = await db.listKnownDistricts("Kota Bekasi");
  assert.ok(districts.includes("Bekasi Timur"));
  assert.deepEqual(districts, [...districts].sort());
  assert.equal(new Set(districts).size, districts.length);
  assert.equal((await db.listKnownDistricts("Kota Depok")).length, 0);
}

// --- 9. Validasi tanggal/waktu rusak ⇒ lempar Error ------------------------------
{
  await assert.rejects(
    db.listPublishedUpcoming({ nowISO: "2026-13-40T99:99:00+07:00" }),
    Error,
  );
  await assert.rejects(
    db.listPublishedUpcoming({ nowISO: "bukan-tanggal" }),
    Error,
  );
  await assert.rejects(
    db.listPublishedUpcoming({ nowISO: "2026-02-30T10:00:00+07:00" }),
    Error,
  );
  await assert.rejects(
    db.createEvent(makeEventInput({ startDate: "2026-02-30" })),
    Error,
  );
  await assert.rejects(
    db.createEvent(makeEventInput({ startTime: "25:00" })),
    Error,
  );
  await assert.rejects(
    db.createEvent(makeEventInput({ startDate: "08/10/2026" })),
    Error,
  );
  await assert.rejects(
    db.createRoutine(makeRoutineInput({ effectiveFrom: "2026-13-01" })),
    Error,
  );
  await assert.rejects(
    db.createRoutineException({
      routineId: rutin.id,
      date: "2026-10-32",
      kind: "libur",
      note: null,
      overrideVenueName: null,
      overrideAddress: null,
      overrideStartTime: null,
      overrideDescription: null,
    }),
    Error,
  );
  // Tanggal kabisat yang sah diterima sebagai nowISO.
  await db.listPublishedUpcoming({ nowISO: "2028-02-29T10:00:00+07:00" });
}

// --- 10. Update event: slug stabil ------------------------------------------------
{
  const updated = await db.updateEvent(eventUtama.id, {
    title: "Maulid Akbar Contoh Diganti",
  });
  assert.equal(updated?.title, "Maulid Akbar Contoh Diganti");
  assert.equal(updated?.slug, "maulid-akbar-contoh");
  assert.ok((updated?.updatedAt ?? "") >= eventUtama.updatedAt);
}

console.log("test-db: OK");
