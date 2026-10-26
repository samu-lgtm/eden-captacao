import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as { formId?: string; session?: string; kind?: string; step?: number };
    if (!b.formId || !b.session || !/^[\w-]{6,64}$/.test(b.session) || (b.kind !== "view" && b.kind !== "step")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await db().from("form_events").insert({ form_id: b.formId, session: b.session, kind: b.kind, step: Math.max(0, Math.min(200, Number(b.step) || 0)) });
  } catch {
    /* las métricas nunca bloquean al lead */
  }
  return NextResponse.json({ ok: true });
}
