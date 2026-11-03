import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_AGENDA, type AgendaConfig } from "@/lib/booking";

export const runtime = "nodejs";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const num = (v: unknown, min: number, max: number, def: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def; };

export async function PUT(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Partial<AgendaConfig>;
  const ranges: AgendaConfig["ranges"] = {};
  for (const d of ["1", "2", "3", "4", "5", "6", "7"]) {
    const list = (b.ranges?.[d] || []).filter((r) => Array.isArray(r) && HHMM.test(r[0]) && HHMM.test(r[1]) && r[0] < r[1]);
    if (list.length) ranges[d] = list.map((r) => [r[0], r[1]] as [string, string]).sort((x, y) => x[0].localeCompare(y[0]));
  }
  const cfg: AgendaConfig = {
    title: String(b.title || DEFAULT_AGENDA.title).trim().slice(0, 80) || DEFAULT_AGENDA.title,
    duration: num(b.duration, 15, 180, DEFAULT_AGENDA.duration),
    buffer: num(b.buffer, 0, 120, DEFAULT_AGENDA.buffer),
    notice: num(b.notice, 0, 168, DEFAULT_AGENDA.notice),
    horizon: num(b.horizon, 1, 90, DEFAULT_AGENDA.horizon),
    step: num(b.step, 15, 60, DEFAULT_AGENDA.step),
    ranges,
    notify_to: String(b.notify_to || "").trim().slice(0, 300),
  };
  const { error } = await db().from("app_settings").upsert({ key: "agenda", value: cfg, updated_at: new Date().toISOString() });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
