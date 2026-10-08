import assert from "node:assert/strict";

// Env harus dipasang sebelum modul dimuat (getSiteUrl membaca env
// saat pemanggilan, jadi urutan ini aman selama sebelum pemanggilan).
process.env.NEXT_PUBLIC_SITE_URL = "https://info-majelis.example/";

const {
  absoluteUrl,
  buildEventJsonLd,
  categoryOgImagePath,
  getSiteUrl,
  serializeJsonLd,
  truncateDescription,
} = await import("../src/lib/seo.ts");

// --- getSiteUrl / absoluteUrl ---------------------------------------------------
assert.equal(getSiteUrl(), "https://info-majelis.example");
assert.equal(
  absoluteUrl("/acara/maulid-akbar"),
  "https://info-majelis.example/acara/maulid-akbar",
);
assert.equal(
  absoluteUrl("https://cdn.example/poster.webp"),
  "https://cdn.example/poster.webp",
);
assert.equal(categoryOgImagePath("maulid"), "/og/maulid.png");

// --- buildEventJsonLd: struktur schema.org/Event --------------------------------
const ld = buildEventJsonLd({
  title: "Maulid Akbar",
  startISO: "2026-10-20T19:30:00+07:00",
  endISO: "2026-10-20T21:00:00+07:00",
  venueName: "Masjid Agung",
  address: "Jl. Raya No. 1",
  district: "Bekasi Timur",
  city: "Kota Bekasi",
  organizerName: "Majelis Nurul Iman",
  organizerUrl: "/majelis/majelis-nurul-iman",
  description: "Deskripsi acara",
  imageUrl: "/uploads/poster-1.webp",
  canonicalPath: "/acara/maulid-akbar",
});
assert.equal(ld["@type"], "Event");
assert.equal(ld.name, "Maulid Akbar");
assert.equal(ld.startDate, "2026-10-20T19:30:00+07:00");
assert.equal(ld.endDate, "2026-10-20T21:00:00+07:00");
assert.equal(ld.eventStatus, "https://schema.org/EventScheduled");
assert.equal(ld.url, "https://info-majelis.example/acara/maulid-akbar");
const location = ld.location as {
  "@type": string;
  name: string;
  address: Record<string, string>;
};
assert.equal(location["@type"], "Place");
assert.equal(location.name, "Masjid Agung");
assert.equal(location.address.streetAddress, "Jl. Raya No. 1");
assert.equal(location.address.addressLocality, "Kota Bekasi");
assert.equal(location.address.addressCountry, "ID");
const organizer = ld.organizer as Record<string, string>;
assert.equal(organizer.name, "Majelis Nurul Iman");
assert.equal(
  organizer.url,
  "https://info-majelis.example/majelis/majelis-nurul-iman",
);
assert.deepEqual(ld.image, ["https://info-majelis.example/uploads/poster-1.webp"]);
// Field internal tidak pernah muncul.
assert.equal(JSON.stringify(ld).includes("sourceInfo"), false);

// Field opsional kosong ⇒ kunci tidak dibuat.
const minimal = buildEventJsonLd({
  title: "Pengajian",
  startISO: "2026-10-23T19:30:00+07:00",
  endISO: null,
  venueName: "Masjid Agung",
  address: "Jl. Raya No. 1",
  district: "Bekasi Timur",
  city: "Kota Bekasi",
  organizerName: null,
  organizerUrl: null,
  description: null,
  imageUrl: null,
  canonicalPath: "/acara/pengajian",
});
assert.equal("endDate" in minimal, false);
assert.equal("organizer" in minimal, false);
assert.equal("image" in minimal, false);
assert.equal("description" in minimal, false);

// --- serializeJsonLd: "</script>" tidak boleh lolos mentah -----------------------
const jahat = buildEventJsonLd({
  title: "X</script><script>alert(1)</script>",
  startISO: "2026-10-20T19:30:00+07:00",
  endISO: null,
  venueName: "V",
  address: "A",
  district: "D",
  city: "Kota Bekasi",
  organizerName: null,
  organizerUrl: null,
  description: null,
  imageUrl: null,
  canonicalPath: "/acara/x",
});
const serialized = serializeJsonLd(jahat);
assert.equal(serialized.includes("</script>"), false);
assert.equal(JSON.parse(serialized).name, "X</script><script>alert(1)</script>");

// --- truncateDescription ----------------------------------------------------------
assert.equal(truncateDescription("  teks   pendek  "), "teks pendek");
const panjang = truncateDescription("kata ".repeat(60));
assert.ok(panjang.length <= 160);
assert.ok(panjang.endsWith("…"));

console.log("test-seo: OK");
