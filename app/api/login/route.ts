import { NextRequest, NextResponse } from "next/server";
import { COOKIE, makeSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const pass = String(form.get("password") || "");
  const expected = process.env.ADMIN_PASSWORD || "";
  const url = req.nextUrl.clone();
  url.search = "";
  if (!expected || pass !== expected) {
    url.pathname = "/login";
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, 303);
  }
  const s = await makeSession();
  url.pathname = "/admin";
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(COOKIE, s.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: s.maxAge });
  return res;
}
