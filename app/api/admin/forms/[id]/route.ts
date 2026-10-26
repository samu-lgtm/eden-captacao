import { NextRequest, NextResponse } from "next/server";
import { db, getForm, logActivity } from "@/lib/db";
import type { Field, FieldType, FormSettings } from "@/lib/types";
import { FIELD_TYPES, DEFAULT_SETTINGS } from "@/lib/types";

export const runtime = "nodejs";

function cleanFields(input: unknown): Field[] | string {
  if (!Array.isArray(input) || !input.length) return "El formulario necesita al menos una pregunta.";
  const seen = new Set<string>();
  const out: Field[] = [];
  for (const raw of input as Record<string, unknown>[]) {
    const type = String(raw.type) as FieldType;
    if (!(type in FIELD_TYPES)) return `Tipo de pregunta no válido: ${type}`;
    let id = String(raw.id || "").replace(/[^\w-]/g, "").slice(0, 40) || Math.random().toString(36).slice(2, 8);
    while (seen.has(id)) id += "x";
    seen.add(id);
    const label = String(raw.label || "").trim();
    if (!label) return "Hay una pregunta sin texto.";
    const f: Field = { id, type, label: label.slice(0, 400), required: !!raw.required };
    if (type === "select") {
      const opts = (Array.isArray(raw.options) ? raw.options : []).map((o) => String(o).trim()).filter(Boolean);
      if (opts.length < 2) return `La pregunta "${label}" necesita al menos dos opciones.`;
      f.options = opts.slice(0, 20);
    }
    if (type === "consent") f.text = String(raw.text || "").slice(0, 2000);
    out.push(f);
  }
  return out;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const current = await getForm(params.id);
  if (!current) return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  const b = await req.json();

  const fields = cleanFields(b.fields);
  if (typeof fields === "string") return NextResponse.json({ error: fields }, { status: 422 });

  const slug = String(b.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug || ["admin", "api", "login", "_next"].includes(slug)) return NextResponse.json({ error: "Dirección no válida." }, { status: 422 });

  const s = { ...DEFAULT_SETTINGS, ...current.settings } as FormSettings;
  const inS = (b.settings || {}) as Partial<FormSettings>;
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof FormSettings)[]) {
    if (k in inS) {
      const v = inS[k];
      (s as unknown as Record<string, unknown>)[k] = typeof DEFAULT_SETTINGS[k] === "boolean" ? !!v : String(v ?? "").trim();
    }
  }
  s.pixel_id = s.pixel_id.replace(/\s/g, "");

  const { data: updated, error } = await db()
    .from("forms")
    .update({
      name: String(b.name || "").trim() || current.name,
      slug,
      folder: String(b.folder || "").trim(),
      status: b.status === "ativo" ? "ativo" : "pausado",
      lang: b.lang === "pt" ? "pt" : "es",
      fields,
      settings: s,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("id, status");
  if (error) {
    console.error("[forms PUT] error", error);
    const msg = error.code === "23505" ? "Ya existe otro formulario con esa dirección." : error.message;
    return NextResponse.json({ error: msg }, { status: 422 });
  }
  if (!updated || !updated.length) {
    console.error("[forms PUT] 0 filas actualizadas", params.id);
    return NextResponse.json({ error: "La base de datos no ha aceptado el cambio. Revisa que SUPABASE_SERVICE_ROLE_KEY sea la clave secreta (sb_secret_… o service_role), no la publishable/anon." }, { status: 500 });
  }
  console.log("[forms PUT] guardado", params.id, updated[0].status);
  if (current.status !== b.status) await logActivity("form", `${current.name}: ${b.status === "ativo" ? "activado" : "pausado"}.`, params.id);
  return NextResponse.json({ ok: true, slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const current = await getForm(params.id);
  if (!current) return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  const { error } = await db().from("forms").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity("form", `Formulario "${current.name}" eliminado con sus respuestas.`);
  return NextResponse.json({ ok: true });
}
