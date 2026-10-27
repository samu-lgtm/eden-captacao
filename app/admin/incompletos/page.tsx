import Link from "next/link";
import { db, normalizeForm } from "@/lib/db";
import type { Form } from "@/lib/types";
import { fmtDT } from "@/lib/fmt";
import { purgeOldPartials, PARTIAL_DAYS } from "@/lib/partials";
import { PartialActions } from "./PartialActions";

interface Partial { id: string; form_id: string; session: string; answers: Record<string, string>; step: number; contacted: boolean; created_at: string; updated_at: string }

export default async function Incompletos() {
  await purgeOldPartials();
  const since = new Date(Date.now() - PARTIAL_DAYS * 86400000).toISOString();
  const [{ data: pd, error }, { data: fd }, { data: rd }] = await Promise.all([
    db().from("partials").select("*").order("updated_at", { ascending: false }).limit(500),
    db().from("forms").select("*"),
    db().from("responses").select("source").gte("created_at", since).limit(5000),
  ]);
  if (error) {
    return (
      <>
        <div className="top"><h1>Incompletos</h1></div>
        <div className="errbox">Falta crear la tabla de incompletos en Supabase. Ejecuta el archivo <b>supabase/002_incompletos.sql</b> en el SQL Editor. ({error.message})</div>
      </>
    );
  }
  const forms = ((fd || []) as Form[]).map(normalizeForm);
  const done = new Set(((rd || []) as { source: Record<string, string> }[]).map((r) => r.source?.session).filter(Boolean));
  const rows = ((pd || []) as Partial[]).filter((p) => !done.has(p.session));
  const val = (p: Partial, type: string) => {
    const f = forms.find((x) => x.id === p.form_id);
    const fld = f?.fields.find((x) => x.type === type);
    return fld ? p.answers[fld.id] || "" : "";
  };

  return (
    <>
      <div className="top"><h1>Incompletos</h1><span className="muted">{rows.length} en los últimos {PARTIAL_DAYS} días</span></div>
      <p className="muted" style={{ margin: "-8px 0 14px", maxWidth: "68ch" }}>
        Personas que dejaron sus datos de contacto pero no terminaron el formulario. Uso limitado: un solo contacto para ayudarles a terminar o resolver dudas, sin añadirlas a campañas. Se borran solas a los {PARTIAL_DAYS} días.
      </p>
      {!rows.length ? <div className="card empty">No hay formularios incompletos.</div> : (
        <div className="card tw"><table>
          <thead><tr><th>Última actividad</th><th>Nombre</th><th>Teléfono</th><th>E-mail</th><th>Formulario</th><th>Llegó a</th><th>Estado</th><th></th></tr></thead>
          <tbody>{rows.map((p) => {
            const f = forms.find((x) => x.id === p.form_id);
            const total = f ? f.fields.filter((x) => x.type !== "consent").length : 0;
            const reached = f ? f.fields.slice(0, p.step).filter((x) => x.type !== "consent").length : p.step;
            return (
              <tr key={p.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDT(p.updated_at)}</td>
                <td>{val(p, "text") || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{val(p, "phone") || "—"}</td>
                <td>{val(p, "email") || "—"}</td>
                <td>{f ? <Link href={`/admin/forms/${f.id}`}>{f.name}</Link> : "—"}</td>
                <td className="muted">{reached} de {total}</td>
                <td>{p.contacted ? <span className="pill ok">Contactado</span> : <span className="pill warn">Pendiente</span>}</td>
                <td><PartialActions id={p.id} contacted={p.contacted} /></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
