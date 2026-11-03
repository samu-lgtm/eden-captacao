import { NextRequest, NextResponse } from "next/server";
import { getAgenda, freeSlots, validToken, leadTz } from "@/lib/booking";
import { db, getForm } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = req.nextUrl.searchParams.get("r") || "";
  const t = req.nextUrl.searchParams.get("t") || "";
  if (!validToken(r, t)) return NextResponse.json({ error: "Enlace no válido." }, { status: 403 });
  try {
    const cfg = await getAgenda();
    const { data } = await db().from("responses").select("form_id").eq("id", r).maybeSingle();
    const form = data ? await getForm((data as { form_id: string }).form_id) : null;
    const slots = await freeSlots(cfg, leadTz(form?.lang || "es"));
    return NextResponse.json({ duration: cfg.duration, slots: slots.map((s) => s.toISOString()) });
  } catch (e) {
    console.error("[slots]", e);
    return NextResponse.json({ error: "No hemos podido cargar la agenda." }, { status: 502 });
  }
}
