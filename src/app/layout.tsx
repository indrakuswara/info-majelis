import type { Metadata, Viewport } from "next";
import { Amiri, Fraunces, Geist, Geist_Mono, Public_Sans } from "next/font/google";
import { Suspense } from "react";
import { NameplateDate } from "../components/public/NameplateDate.tsx";
import { Serambi } from "../components/public/Serambi.tsx";
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

// Font Serambi (spec redesign §5.4): dimuat di samping Geist — Geist
// tetap rujukan admin, tiga font ini hanya dirujuk shell publik lewat
// token --font-display/--font-body/--font-arab di globals.css.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
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
  // Zamrud Serambi (spec redesign §5.4) — selaras theme_color manifest.
  themeColor: "#0b3d2e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${publicSans.variable} ${amiri.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-50">
        <Serambi
          nameplateDate={
            // Tanggal nameplate dirender server (NameplateDate) dan
            // dibungkus Suspense: halaman statis (/offline, 404) tetap
            // ter-prerender sebagai shell, tanggal mengalir per request.
            <Suspense fallback={null}>
              <NameplateDate />
            </Suspense>
          }
        >
          {children}
        </Serambi>
      </body>
    </html>
  );
}
