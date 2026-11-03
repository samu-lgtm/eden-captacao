import { NextRequest, NextResponse } from "next/server";
import { db, getForm, logActivity } from "@/lib/db";
import { getAgenda, freeSlots, validToken, isQualified, AGENDA_TZ } from "@/lib/booking";
import { createEvent } from "@/lib/google";
import { sendCapi } from "@/lib/meta";
import { notifyBooking } from "@/lib/mail";
import type { ResponseRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { r?: string; t?: string; start?: string; eventId?: string; fbp?: string; fbc?: string };
  const responseId = String(b.r || "");
  if (!validToken(responseId, String(b.t || ""))) return NextResponse.json({ error: "Enlace no válido." }, { status: 403 });

  const { data } = await db().from("responses").select("*").eq("id", responseId).maybeSingle();
  const resp = data as (ResponseRow & { ip: string | null; user_agent: string | null }) | null;
  if (!resp) return NextResponse.json({ error: "No encontramos tu solicitud." }, { status: 404 });
  const form = await getForm(resp.form_id);
  if (!form || !form.settings.booking_enabled || !isQualified(form, resp.answers)) return NextResponse.json({ error: "La agenda no está disponible." }, { status: 403 });

  const { data: existing } = await db().from("bookings").select("start_at").eq("response_id", responseId).eq("status", "confirmada").maybeSingle();
  if (existing) return NextResponse.json({ error: "Ya tienes una reunión reservada.", start: existing.start_at }, { status: 409 });

  const cfg = await getAgenda();
  const start = new Date(String(b.start || ""));
  if (isNaN(start.getTime())) return NextResponse.json({ error: "Horario no válido." }, { status: 422 });
  const free = await freeSlots(cfg);
  if (!free.some((s) => s.getTime() === start.getTime())) {
    return NextResponse.json({ error: "Ese horario se acaba de ocupar. Elige otro, por favor.", taken: true }, { status: 409 });
  }
  const end = new Date(start.getTime() + cfg.duration * 60000);

  const val = (type: string) => { const f = form.fields.find((x) => x.type === type); return f ? String(resp.answers[f.id] ?? "") : ""; };
  const name = val("text") || "Lead", email = val("email"), phone = val("phone");
  const lines = form.fields.filter((f) => f.type !== "consent").map((f) => `${f.label}\n${resp.answers[f.id] ?? "—"}`);

  let ev: { id: string; hangoutLink?: string };
  try {
    ev = await createEvent({
      summary: `${cfg.title} · ${name}`,
      description: `Reserva desde el formulario "${form.name}".\n\n${lines.join("\n\n")}`,
      start, end, attendee: email, tz: AGENDA_TZ,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    await logActivity("err", `No se pudo crear la reunión de ${name} en Google Calendar: ${msg}`, form.id);
    return NextResponse.json({ error: "No hemos podido reservar. Inténtalo de nuevo en unos minutos." }, { status: 502 });
  }

  const { error } = await db().from("bookings").insert({
    form_id: form.id, response_id: responseId, start_at: start.toISOString(), end_at: end.toISOString(),
    name, email, phone, google_event_id: ev.id, meet_link: ev.hangoutLink || null,
  });
  if (error) await logActivity("err", `Reunión de ${name} creada en Google pero no guardada en el panel: ${error.message}`, form.id);
  await logActivity("agenda", `Reunión reservada por ${name} para ${start.toLocaleString("es-ES", { timeZone: AGENDA_TZ, dateStyle: "medium", timeStyle: "short" })} (hora de Madrid).`, form.id);

  const tasks: Promise<unknown>[] = [];
  const scheduleEvent = form.settings.event_schedule || "Reunion_Agendada";
  if (form.settings.pixel_id && form.settings.capi_token) {
    const eventId = typeof b.eventId === "string" && /^[\w-]{6,64}$/.test(b.eventId) ? b.eventId : crypto.randomUUID();
    tasks.push(sendCapi(form, { id: resp.id, answers: resp.answers, event_id: eventId }, { ip: resp.ip, userAgent: resp.user_agent, fbp: b.fbp, fbc: b.fbc }, scheduleEvent).then((r) =>
      logActivity(r.ok ? "meta" : "err", r.ok ? `Evento ${scheduleEvent} de ${name} enviado a Meta.` : `Meta rechazó el evento ${scheduleEvent} de ${name}: ${r.error}`, form.id)));
  }
  tasks.push(notifyBooking(cfg.notify_to, { name, email, phone, form: form.name, start, meet: ev.hangoutLink || "" }));
  await Promise.allSettled(tasks);

  return NextResponse.json({ ok: true, start: start.toISOString(), end: end.toISOString(), meet: ev.hangoutLink || null, event: scheduleEvent });
}
