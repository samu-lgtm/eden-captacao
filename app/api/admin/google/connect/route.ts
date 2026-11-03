import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_SCOPES, googleConfigured, redirectUri } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!googleConfigured()) return NextResponse.redirect(new URL("/admin/agenda?google=sin-config", req.url));
  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(req.nextUrl.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
