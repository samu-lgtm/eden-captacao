import { NextRequest, NextResponse } from "next/server";
import { COOKIE, validSession } from "./lib/session";

export async function middleware(req: NextRequest) {
  const ok = await validSession(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesión caducada. Vuelve a entrar en el panel." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
