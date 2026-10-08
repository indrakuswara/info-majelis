// Proteksi area /admin (plan Task 5; konvensi Next.js 16 — proxy,
// bukan middleware). Verifikasi JWT memakai jose lewat session.ts;
// cookie dibaca dari request (bukan next/headers).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const email = token ? await verifySessionToken(token) : null;

  if (pathname === "/admin/login") {
    // Sudah login -> langsung ke dashboard.
    if (email) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (!email) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
