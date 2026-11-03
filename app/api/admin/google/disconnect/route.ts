import { NextResponse } from "next/server";
import { saveConn } from "@/lib/google";
import { logActivity } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  await saveConn(null);
  await logActivity("agenda", "Google Calendar desconectado. Las agendas de los formularios dejan de mostrarse.");
  return NextResponse.json({ ok: true });
}
