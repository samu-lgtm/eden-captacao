import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
