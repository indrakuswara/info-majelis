import assert from "node:assert/strict";
import {
  buildMapsUrl,
  buildShareText,
  parseMapsCoords,
} from "../src/lib/share.ts";

// --- buildShareText: format PERSIS spec §10 ------------------------------------
// `*[Judul]* — [Hari, Tanggal], [Jam] di [Nama Tempat], [Kecamatan], [Kota]. Detail: [URL]`
assert.equal(
  buildShareText({
    title: "Maulid Akbar",
    dateLabel: "Selasa, 20 Oktober 2026",
    timeLabel: "19.30 WIB",
    venueName: "Masjid Agung",
    district: "Bekasi Timur",
    city: "Kota Bekasi",
    url: "https://infomajelis.example/event/maulid-akbar",
  }),
  "*Maulid Akbar* — Selasa, 20 Oktober 2026, 19.30 WIB di Masjid Agung, Bekasi Timur, Kota Bekasi. Detail: https://infomajelis.example/event/maulid-akbar",
);

// --- buildMapsUrl: URL manual menang apa adanya ---------------------------------
assert.equal(
  buildMapsUrl({
    mapsUrl: "https://maps.app.goo.gl/abc123",
    venueName: "Masjid Agung",
    address: "Jl. Raya No. 1",
    district: "Bekasi Timur",
    city: "Kota Bekasi",
  }),
  "https://maps.app.goo.gl/abc123",
);

// --- buildMapsUrl: fallback pencarian Google Maps, query ter-encode --------------
assert.equal(
  buildMapsUrl({
    mapsUrl: null,
    venueName: "Masjid Agung",
    address: "Jl. Raya No. 1",
    district: "Bekasi Timur",
    city: "Kota Bekasi",
  }),
  "https://www.google.com/maps/search/?api=1&query=Masjid%20Agung%20Jl.%20Raya%20No.%201%20Bekasi%20Timur%20Kota%20Bekasi",
);

// mapsUrl kosong / hanya spasi diperlakukan sama seperti null (fallback).
assert.equal(
  buildMapsUrl({
    mapsUrl: "   ",
    venueName: "Masjid Agung",
    address: "Jl. Raya No. 1",
    district: "Bekasi Timur",
    city: "Kota Bekasi",
  }),
  "https://www.google.com/maps/search/?api=1&query=Masjid%20Agung%20Jl.%20Raya%20No.%201%20Bekasi%20Timur%20Kota%20Bekasi",
);

// --- buildMapsUrl: koordinat tersimpan menang atas pencarian teks ----------------
// (Task 13: prioritas manual → koordinat → query, spec §10/§13.4)
assert.equal(
  buildMapsUrl({
    mapsUrl: null,
    venueName: "Masjid Agung",
    address: "Jl. Raya No. 1",
    district: "Bekasi Timur",
    city: "Kota Bekasi",
    lat: -6.2383,
    lng: 106.9756,
  }),
  "https://www.google.com/maps/search/?api=1&query=-6.2383,106.9756",
);

// URL manual tetap menang atas koordinat.
assert.equal(
  buildMapsUrl({
    mapsUrl: "https://maps.app.goo.gl/abc123",
    venueName: "Masjid Agung",
    address: "Jl. Raya No. 1",
    district: "Bekasi Timur",
    city: "Kota Bekasi",
    lat: -6.2383,
    lng: 106.9756,
  }),
  "https://maps.app.goo.gl/abc123",
);

// Koordinat tidak lengkap / di luar rentang ⇒ jatuh ke pencarian teks.
for (const coords of [
  { lat: -6.2383, lng: null },
  { lat: null, lng: 106.9756 },
  { lat: -999, lng: 999 },
  { lat: Number.NaN, lng: 106.9756 },
]) {
  assert.equal(
    buildMapsUrl({
      mapsUrl: null,
      venueName: "Masjid Agung",
      address: "Jl. Raya No. 1",
      district: "Bekasi Timur",
      city: "Kota Bekasi",
      ...coords,
    }),
    "https://www.google.com/maps/search/?api=1&query=Masjid%20Agung%20Jl.%20Raya%20No.%201%20Bekasi%20Timur%20Kota%20Bekasi",
  );
}

// --- parseMapsCoords: pola @lat,lng ----------------------------------------------
assert.deepEqual(
  parseMapsCoords(
    "https://www.google.com/maps/place/Masjid+Agung/@-6.2383,106.9756,17z",
  ),
  { lat: -6.2383, lng: 106.9756 },
);

// --- parseMapsCoords: pola ?q=lat,lng ----------------------------------------------
assert.deepEqual(parseMapsCoords("https://www.google.com/maps?q=-6.2383,106.9756"), {
  lat: -6.2383,
  lng: 106.9756,
});
assert.deepEqual(
  parseMapsCoords("https://maps.google.com/?hl=id&q=3.5952,98.6722&z=15"),
  { lat: 3.5952, lng: 98.6722 },
);

// --- parseMapsCoords: input sampah ⇒ null, bukan error ------------------------------
assert.equal(parseMapsCoords("bukan url sama sekali"), null);
assert.equal(parseMapsCoords(""), null);
assert.equal(parseMapsCoords("https://example.com/@abc,def"), null);
assert.equal(parseMapsCoords("https://maps.app.goo.gl/abc123"), null);
// Koordinat di luar rentang bumi ⇒ null.
assert.equal(parseMapsCoords("https://www.google.com/maps/@-999,999,17z"), null);

console.log("test-share: OK");
