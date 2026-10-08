// Sitemap dinamis (spec §12): HANYA konten terbit — event mendatang
// dan arsip, jadwal rutin terbit+aktif, profil majelis terbit. Semua
// slug diambil dari fungsi repository published-only, sehingga draft
// tidak pernah masuk sitemap.

import type { MetadataRoute } from "next";
import { connection } from "next/server";
import {
  ensureSchema,
  listPublishedArchive,
  listPublishedMajelis,
  listPublishedRoutines,
  listPublishedUpcoming,
} from "../lib/db.ts";
import { getSiteUrl } from "../lib/seo.ts";
import { nowWibISO } from "../lib/utils.ts";

/** Origin untuk URL absolut sitemap; fallback dev lokal. */
function sitemapBase(): string {
  return getSiteUrl() || "http://localhost:3100";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  await ensureSchema();
  const base = sitemapBase();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/acara`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/jadwal`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/majelis`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/arsip`, changeFrequency: "weekly", priority: 0.5 },
  ];

  const [upcoming, archive, routines, majelis] = await Promise.all([
    listPublishedUpcoming({ nowISO: nowWibISO() }),
    listPublishedArchive({}),
    listPublishedRoutines({}),
    listPublishedMajelis({}),
  ]);

  const seen = new Set<string>();
  const pushDetail = (path: string, updatedAt: string, priority: number) => {
    if (seen.has(path)) return;
    seen.add(path);
    entries.push({
      url: `${base}${path}`,
      lastModified: new Date(updatedAt),
      changeFrequency: "weekly",
      priority,
    });
  };

  for (const event of [...upcoming, ...archive]) {
    pushDetail(`/acara/${event.slug}`, event.updatedAt, 0.7);
  }
  for (const routine of routines) {
    pushDetail(`/acara/${routine.slug}`, routine.updatedAt, 0.7);
  }
  for (const profil of majelis) {
    pushDetail(`/majelis/${profil.slug}`, profil.updatedAt, 0.6);
  }

  return entries;
}
