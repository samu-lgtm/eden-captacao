import { NextRequest, NextResponse } from "next/server";
import { redirectUri, saveConn } from "@/lib/google";
import { logActivity } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const r = NextResponse.redirect(new URL(`/admin/agenda?google=${q}`, req.url));
    r.cookies.set("g_state", "", { path: "/", maxAge: 0 });
    return r;
  };
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return back("cancelado");
  if (!p.get("state") || p.get("state") !== req.cookies.get("g_state")?.value) return back("error");

  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: p.get("code") || "",
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(req.nextUrl.origin),
      grant_type: "authorization_code",
    }),
  });
  const j = (await tok.json()) as { access_token?: string; refresh_token?: string; scope?: string };
  if (!tok.ok || !j.refresh_token || !j.access_token) return back("error");
  if (!String(j.scope || "").includes("calendar.events")) return back("permisos");

  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${j.access_token}` } });
  const u = (await info.json().catch(() => ({}))) as { email?: string };
  await saveConn({ refresh_token: j.refresh_token, email: u.email || "", connected_at: new Date().toISOString() });
  await logActivity("agenda", `Google Calendar conectado (${u.email || "cuenta de Google"}).`);
  return back("ok");
}
