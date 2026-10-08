import type { Metadata, Viewport } from "next";
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
  // PWA (plan Task 14; spec §12): manifest statis di public/ + ikon kubah.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Info Majelis",
    statusBarStyle: "default",
  },
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

export const viewport: Viewport = {
  // Tinta nameplate arah Kalender Dinding (Task 14) — selaras
  // theme_color manifest.
  themeColor: "#1a1a1a",
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
