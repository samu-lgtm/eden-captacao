import { NextResponse } from "next/server";
import { db, logActivity } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const runtime = "nodejs";

export async function POST() {
  const suffix = Math.random().toString(36).slice(2, 6);
  const { data, error } = await db()
    .from("forms")
    .insert({
      name: "Nuevo formulario",
      slug: `nuevo-${suffix}`,
      folder: "",
      status: "pausado",
      lang: "es",
      fields: [
        { id: "nombre", type: "text", label: "¿Cómo te llamas?", required: true },
        { id: "email", type: "email", label: "¿Cuál es tu e-mail?", required: true },
        { id: "telefono", type: "phone", label: "¿Cuál es tu teléfono?", required: true },
        { id: "rgpd", type: "consent", label: "Protección de datos", required: true, text: "Acepto que EC Digital Performance, SL (Eden) trate mis datos para contactarme sobre sus servicios y que los comparta de forma cifrada con Meta para medir sus campañas, según la política de privacidad." },
      ],
      settings: DEFAULT_SETTINGS,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "No se pudo crear" }, { status: 500 });
  await logActivity("form", "Formulario nuevo creado.", data.id);
  return NextResponse.json({ id: data.id });
}
