import { NextRequest, NextResponse } from "next/server";
import { db, getForm, logActivity } from "@/lib/db";
import { notifyNewLead } from "@/lib/mail";
import type { ResponseRow } from "@/lib/types";

export const runtime = "nodejs";

// Vuelve a enviar el aviso de nuevo lead por e-mail (por ejemplo, si falló el SMTP).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data } = await db().from("responses").select("*").eq("id", params.id).maybeSingle();
  const r = data as ResponseRow | null;
  if (!r) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  const form = await getForm(r.form_id);
  if (!form) return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  const base = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  const res = await notifyNewLead(form, { answers: r.answers, source: r.source }, `${base}/admin/forms/${form.id}?tab=respuestas`);
  const nameField = form.fields.find((f) => f.type === "text");
  const name = nameField ? String(r.answers[nameField.id] || "Lead") : "Lead";
  await logActivity(res.ok ? "mail" : "err", res.ok ? `Aviso de ${name} reenviado a ${form.settings.notify_to}.` : `No se pudo reenviar el aviso de ${name}: ${res.error}`, form.id);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: 502 });
}
