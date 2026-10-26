import Link from "next/link";
import { db, normalizeForm } from "@/lib/db";
import type { Form } from "@/lib/types";
import { pct } from "@/lib/fmt";
import { NewFormButton } from "./NewFormButton";

async function count(table: string, formId: string, extra?: (q: any) => any) {
  let q = db().from(table).select("id", { count: "exact", head: true }).eq("form_id", formId);
  if (extra) q = extra(q);
  const { count } = await q;
  return count || 0;
}

export default async function FormsPage() {
  const { data, error } = await db().from("forms").select("*").order("folder").order("name");
  if (error) return <div className="errbox">No se pudo leer la base de datos: {error.message}</div>;
  const forms = (data as Form[]).map(normalizeForm);
  const stats = await Promise.all(forms.map(async (f) => ({
    id: f.id,
    views: await count("form_events", f.id, (q) => q.eq("kind", "view")),
    leads: await count("responses", f.id),
  })));
  const folders = Array.from(new Set(forms.map((f) => f.folder || "Sin carpeta")));

  return (
    <>
      <div className="top"><h1>Formularios</h1><NewFormButton /></div>
      <p className="muted" style={{ margin: "-8px 0 6px", maxWidth: "62ch" }}>Cada formulario guarda el lead, lo envía a Meta por la Conversions API y avisa por e-mail al responsable.</p>
      {!forms.length ? <div className="card empty">Todavía no hay formularios. Crea el primero.</div> : null}
      {folders.map((fo) => (
        <div key={fo}>
          <div className="folder">{fo}</div>
          <div className="flist">
            {forms.filter((f) => (f.folder || "Sin carpeta") === fo).map((f) => {
              const s = stats.find((x) => x.id === f.id)!;
              const warn = f.status === "ativo" && (!f.settings.pixel_id || !f.settings.capi_token);
              return (
                <Link key={f.id} href={`/admin/forms/${f.id}`} className="card fitem">
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 400 }}>{f.name}</span>
                      {f.status === "ativo" ? <span className="pill ok">Activo</span> : <span className="pill off">En pausa</span>}
                      {warn ? <span className="pill warn">Sin Conversions API</span> : null}
                    </div>
                    <div className="row muted" style={{ fontSize: 12, marginTop: 6, gap: 12 }}>
                      <span className="slug">/{f.slug}</span>
                      <span>{f.lang === "es" ? "Español" : "Portugués"}</span>
                    </div>
                  </div>
                  <div className="fstats">
                    <div><b>{s.views}</b><span>visitas</span></div>
                    <div><b>{s.leads}</b><span>leads</span></div>
                    <div><b>{pct(s.leads, s.views)}</b><span>conversión</span></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
