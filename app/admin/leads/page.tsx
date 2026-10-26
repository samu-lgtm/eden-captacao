import Link from "next/link";
import { db, normalizeForm } from "@/lib/db";
import type { Form, ResponseRow } from "@/lib/types";
import { fmtDT } from "@/lib/fmt";

export default async function Leads() {
  const [{ data: fd }, { data: rd }] = await Promise.all([
    db().from("forms").select("*"),
    db().from("responses").select("*").order("created_at", { ascending: false }).limit(300),
  ]);
  const forms = ((fd || []) as Form[]).map(normalizeForm);
  const rs = (rd || []) as ResponseRow[];
  const val = (r: ResponseRow, type: string) => {
    const f = forms.find((x) => x.id === r.form_id);
    const fld = f?.fields.find((x) => x.type === type);
    return fld ? String(r.answers[fld.id] ?? "") : "";
  };
  return (
    <>
      <div className="top"><h1>Leads</h1><span className="muted">Últimos {rs.length} de todos los formularios</span></div>
      {!rs.length ? <div className="card empty">Todavía no han entrado leads.</div> : (
        <div className="card tw"><table>
          <thead><tr><th>Recibido</th><th>Nombre</th><th>E-mail</th><th>Teléfono</th><th>Instagram</th><th>Formulario</th><th>Meta</th></tr></thead>
          <tbody>{rs.map((r) => {
            const f = forms.find((x) => x.id === r.form_id);
            return (
              <tr key={r.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDT(r.created_at)}</td>
                <td>{val(r, "text")}</td><td>{val(r, "email")}</td><td style={{ whiteSpace: "nowrap" }}>{val(r, "phone")}</td><td>{val(r, "instagram")}</td>
                <td>{f ? <Link href={`/admin/forms/${f.id}?tab=respuestas`}>{f.name}</Link> : "—"}</td>
                <td>{r.meta_status === "enviado" ? <span className="pill ok">Enviado</span> : r.meta_status === "erro" ? <span className="pill err">Falló</span> : <span className="pill off">—</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
