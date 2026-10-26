import { NextRequest, NextResponse } from "next/server";
import { db, getForm, logActivity } from "@/lib/db";
import { sendCapi } from "@/lib/meta";
import type { ResponseRow } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data } = await db().from("responses").select("*").eq("id", params.id).maybeSingle();
  const r = data as (ResponseRow & { ip: string | null; user_agent: string | null }) | null;
  if (!r) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  const form = await getForm(r.form_id);
  if (!form) return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  const res = await sendCapi(form, r, { ip: r.ip, userAgent: r.user_agent });
  await db().from("responses").update({ meta_status: res.ok ? "enviado" : "erro", meta_error: res.ok ? null : res.error }).eq("id", r.id);
  await logActivity(res.ok ? "meta" : "err", res.ok ? `Lead reenviado a Meta.` : `Reenvío a Meta fallido: ${res.error}`, form.id);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: 502 });
}
