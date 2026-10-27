import { NextRequest, NextResponse } from "next/server";
import { db, getForm, logActivity } from "@/lib/db";
import { sendCapi } from "@/lib/meta";
import { notifyNewLead, autoReply } from "@/lib/mail";
import type { Field } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: Field[], answers: Record<string, unknown>): string | null {
  for (const f of fields) {
    const v = answers[f.id];
    const empty = v === undefined || v === null || v === "" || v === false;
    if (f.required && empty) return `Falta responder: ${f.label}`;
    if (empty) continue;
    if (f.type === "consent" && v !== true) return "Consentimiento no válido";
    if (f.type !== "consent" && typeof v !== "string") return `Respuesta no válida: ${f.label}`;
    if (typeof v === "string" && v.length > 2000) return `Respuesta demasiado larga: ${f.label}`;
    if (f.type === "email" && !EMAIL.test(String(v))) return "E-mail no válido";
    if (f.type === "phone" && String(v).replace(/\D/g, "").length < 8) return "Teléfono no válido";
    if (f.type === "select" && f.options && !f.options.includes(String(v))) return `Opción no válida: ${f.label}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: {
    formId?: string; answers?: Record<string, unknown>; eventId?: string; hp?: string; elapsed?: number;
    fbp?: string; fbc?: string; url?: string; source?: Record<string, string>; session?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Petición no válida" }, { status: 400 }); }

  // Antispam: campo oculto y tiempo mínimo para rellenar.
  if (body.hp || (typeof body.elapsed === "number" && body.elapsed < 2500)) {
    return NextResponse.json({ ok: true });
  }

  const form = body.formId ? await getForm(body.formId) : null;
  if (!form || form.status !== "ativo") return NextResponse.json({ error: "Este formulario no está disponible." }, { status: 404 });

  const answers: Record<string, string | boolean> = {};
  for (const f of form.fields) {
    const v = body.answers?.[f.id];
    if (typeof v === "string") answers[f.id] = v.trim();
    else if (v === true) answers[f.id] = true;
  }
  const err = validate(form.fields, answers);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const eventId = typeof body.eventId === "string" && /^[\w-]{6,64}$/.test(body.eventId) ? body.eventId : crypto.randomUUID();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const userAgent = req.headers.get("user-agent");
  const source: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.source || {})) {
    if (/^(utm_[a-z]+|fbclid|ref)$/.test(k) && typeof v === "string") source[k] = v.slice(0, 200);
  }

  if (typeof body.session === "string" && /^[\w-]{6,64}$/.test(body.session)) source.session = body.session;

  const { data: row, error } = await db()
    .from("responses")
    .insert({ form_id: form.id, answers, source, event_id: eventId, ip, user_agent: userAgent, meta_status: "off" })
    .select("id")
    .single();
  if (error || !row) {
    await logActivity("err", `No se pudo guardar un lead de ${form.name}: ${error?.message || "error desconocido"}`, form.id);
    return NextResponse.json({ error: "No hemos podido guardar tus datos. Inténtalo de nuevo en unos minutos." }, { status: 500 });
  }

  // Si había un incompleto de esta misma sesión, ya no hace falta: el lead ha terminado.
  if (typeof body.session === "string" && /^[\w-]{6,64}$/.test(body.session)) {
    await db().from("partials").delete().eq("form_id", form.id).eq("session", body.session);
  }

  const nameField = form.fields.find((f) => f.type === "text");
  const leadName = nameField ? String(answers[nameField.id] || "Lead") : "Lead";
  const base = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;

  const tasks: Promise<void>[] = [];

  if (form.settings.pixel_id && form.settings.capi_token) {
    tasks.push(
      sendCapi(form, { id: row.id, answers, event_id: eventId }, { ip, userAgent, fbp: body.fbp, fbc: body.fbc, url: body.url }).then(async (r) => {
        await db().from("responses").update({ meta_status: r.ok ? "enviado" : "erro", meta_error: r.ok ? null : r.error }).eq("id", row.id);
        await logActivity(r.ok ? "meta" : "err", r.ok
          ? `Lead de ${leadName} enviado a Meta (Conversions API, ${form.settings.event_name}).`
          : `Conversions API rechazó el lead de ${leadName}: ${r.error}`, form.id);
      }),
    );
  }
  if (form.settings.notify_email) {
    tasks.push(notifyNewLead(form, { answers, source }, `${base}/admin/forms/${form.id}?tab=respostas`).then(async (r) => {
      await logActivity(r.ok ? "mail" : "err", r.ok ? `Aviso de nuevo lead (${leadName}) enviado a ${form.settings.notify_to}.` : `No se pudo enviar el aviso por e-mail: ${r.error}`, form.id);
    }));
  }
  if (form.settings.auto_reply) {
    tasks.push(autoReply(form, { answers }).then(async (r) => { if (!r.ok) await logActivity("err", `Confirmación al lead no enviada: ${r.error}`, form.id); }));
  }
  await Promise.allSettled(tasks);

  return NextResponse.json({ ok: true, redirect: form.settings.redirect_url || null });
}
