import "server-only";
import { db } from "./db";

const GAPI = process.env.GOOGLE_API_URL || "https://www.googleapis.com";
const GTOKEN = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export interface GoogleConn { refresh_token: string; email: string; connected_at: string; calendar_id?: string }

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function redirectUri(origin: string) {
  return `${process.env.PUBLIC_BASE_URL || origin}/api/admin/google/callback`;
}

export async function getConn(): Promise<GoogleConn | null> {
  const { data } = await db().from("app_settings").select("value").eq("key", "google").maybeSingle();
  const v = data?.value as GoogleConn | undefined;
  return v && v.refresh_token ? v : null;
}
export async function saveConn(v: GoogleConn | null) {
  if (!v) await db().from("app_settings").delete().eq("key", "google");
  else await db().from("app_settings").upsert({ key: "google", value: v, updated_at: new Date().toISOString() });
}

let cache: { token: string; exp: number } | null = null;
export async function accessToken(): Promise<string> {
  if (cache && cache.exp > Date.now() + 60000) return cache.token;
  const conn = await getConn();
  if (!conn) throw new Error("Google Calendar no está conectado.");
  const res = await fetch(GTOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`Google rechazó la conexión (${j.error_description || j.error || res.status}). Vuelve a conectar Google Calendar en Agenda.`);
  cache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

async function gfetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) }, signal: AbortSignal.timeout(10000) });
  if (res.status === 204) return {} as T;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: { message?: string } }).error?.message || `Google respondió ${res.status}`);
  return j as T;
}

/** Tramos ocupados del calendario principal entre dos instantes. */
export async function busy(from: Date, to: Date): Promise<{ start: number; end: number }[]> {
  const conn = await getConn();
  const cal = conn?.calendar_id || "primary";
  const j = await gfetch<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(
    `${GAPI}/calendar/v3/freeBusy`,
    { method: "POST", body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: cal }] }) },
  );
  const list = Object.values(j.calendars || {})[0]?.busy || [];
  return list.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
}

export async function createEvent(e: { summary: string; description: string; start: Date; end: Date; attendee: string; tz: string }) {
  const conn = await getConn();
  const cal = encodeURIComponent(conn?.calendar_id || "primary");
  return gfetch<{ id: string; hangoutLink?: string; htmlLink?: string }>(
    `${GAPI}/calendar/v3/calendars/${cal}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: e.summary,
        description: e.description,
        start: { dateTime: e.start.toISOString(), timeZone: e.tz },
        end: { dateTime: e.end.toISOString(), timeZone: e.tz },
        attendees: e.attendee ? [{ email: e.attendee }] : [],
        conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
        reminders: { useDefault: true },
      }),
    },
  );
}

export async function deleteEvent(id: string) {
  const conn = await getConn();
  const cal = encodeURIComponent(conn?.calendar_id || "primary");
  await gfetch(`${GAPI}/calendar/v3/calendars/${cal}/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: "DELETE" });
}
