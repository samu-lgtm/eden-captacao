import { NextRequest, NextResponse } from "next/server";
import { db, getForm } from "@/lib/db";
import { purgeOldPartials } from "@/lib/partials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarda las respuestas de un formulario sin terminar. Solo si el formulario lo tiene activado
// y la persona ya ha pasado por el paso con el aviso (ha dado un teléfono o e-mail).
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as { formId?: string; session?: string; answers?: Record<string, unknown>; step?: number };
    if (!b.formId || !b.session || !/^[\w-]{6,64}$/.test(b.session)) return NextResponse.json({ ok: false }, { status: 400 });
    const form = await getForm(b.formId);
    if (!form || form.status !== "ativo" || !form.settings.partial_enabled) return NextResponse.json({ ok: false }, { status: 404 });

    const answers: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.type === "consent") continue;
      const v = b.answers?.[f.id];
      if (typeof v === "string" && v.trim()) answers[f.id] = v.trim().slice(0, 2000);
    }
    const hasContact = form.fields.some((f) => (f.type === "email" || f.type === "phone") && answers[f.id]);
    if (!hasContact) return NextResponse.json({ ok: false }, { status: 422 });

    await db().from("partials").upsert(
      { form_id: form.id, session: b.session, answers, step: Math.max(0, Math.min(200, Number(b.step) || 0)), updated_at: new Date().toISOString() },
      { onConflict: "form_id,session" },
    );
    await purgeOldPartials();
  } catch {
    /* nunca bloquea al lead */
  }
  return NextResponse.json({ ok: true });
}
