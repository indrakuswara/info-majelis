import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteChrome } from "../components/public/SiteChrome.tsx";
import { getSiteUrl } from "../lib/seo.ts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  // Basis resolusi URL metadata relatif; hanya dipasang bila origin
  // situs diketahui (NEXT_PUBLIC_SITE_URL) agar dev lokal tidak dipaksa.
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: "Info Majelis — Jadwal Maulid, Tabligh Akbar & Kajian",
    template: "%s — Info Majelis",
  },
  description:
    "Direktori jadwal maulid, tabligh akbar, kajian, dan acara majelis. Saat ini memuat acara di Bekasi Raya & Jakarta Timur.",
  openGraph: {
    type: "website",
    siteName: "Info Majelis",
    locale: "id_ID",
    title: "Info Majelis — Jadwal Maulid, Tabligh Akbar & Kajian",
    description:
      "Direktori jadwal maulid, tabligh akbar, kajian, dan acara majelis. Saat ini memuat acara di Bekasi Raya & Jakarta Timur.",
    ...(siteUrl ? { url: siteUrl } : {}),
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-50">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
