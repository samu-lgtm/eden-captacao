import { NextRequest, NextResponse } from "next/server";
import { db, logActivity } from "@/lib/db";
import { deleteEvent } from "@/lib/google";

export const runtime = "nodejs";

// Cancela una reunión: la borra de Google Calendar (Google avisa al lead) y la marca como cancelada.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data } = await db().from("bookings").select("*").eq("id", params.id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
  if (data.google_event_id) {
    try { await deleteEvent(data.google_event_id); } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/deleted|not found|410|404/i.test(msg)) return NextResponse.json({ error: `Google no ha podido cancelar el evento: ${msg}` }, { status: 502 });
    }
  }
  await db().from("bookings").update({ status: "cancelada" }).eq("id", params.id);
  await logActivity("agenda", `Reunión de ${data.name} cancelada.`, data.form_id);
  return NextResponse.json({ ok: true });
}
