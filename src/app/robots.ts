// robots.txt (spec §12): semua area publik boleh diindeks, area
// /admin dilarang, dan sitemap dinyatakan eksplisit.

import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/seo.ts";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl() || "http://localhost:3100";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
