import { NextRequest, NextResponse } from "next/server";
import { db, getForm, logActivity } from "@/lib/db";

export const runtime = "nodejs";

// Crea una copia en pausa con las mismas preguntas y ajustes. Las respuestas no se copian.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const src = await getForm(params.id);
  if (!src) return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });

  const base = `${src.slug}-copia`.slice(0, 60);
  const { data: taken } = await db().from("forms").select("slug").like("slug", `${base}%`);
  const used = new Set(((taken || []) as { slug: string }[]).map((r) => r.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await db()
    .from("forms")
    .insert({
      name: `${src.name} (copia)`,
      slug,
      folder: src.folder,
      status: "pausado",
      lang: src.lang,
      fields: src.fields,
      settings: { ...src.settings, test_event_code: "" },
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "No se pudo duplicar" }, { status: 500 });
  await logActivity("form", `Formulario "${src.name}" duplicado.`, data.id);
  return NextResponse.json({ id: data.id });
}
