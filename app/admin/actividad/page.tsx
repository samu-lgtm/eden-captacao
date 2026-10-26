import { db } from "@/lib/db";
import { fmtDT } from "@/lib/fmt";

const LAB: Record<string, [string, string]> = { meta: ["Meta", "ok"], mail: ["E-mail", "ok"], err: ["Error", "err"], form: ["Formulario", "off"] };

export default async function Actividad() {
  const { data } = await db().from("activity").select("*").order("created_at", { ascending: false }).limit(200);
  const rows = (data || []) as { id: number; created_at: string; kind: string; text: string }[];
  const errors = rows.filter((r) => r.kind === "err" && Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).length;
  return (
    <>
      <div className="top"><h1>Actividad</h1>{errors ? <span className="pill err">{errors} errores en los últimos 7 días</span> : <span className="pill ok">Sin errores en los últimos 7 días</span>}</div>
      <p className="muted" style={{ margin: "-8px 0 14px" }}>Todo lo que la herramienta envía fuera: Meta, e-mails y fallos.</p>
      <div className="card pad"><div className="log">
        {rows.length ? rows.map((r) => (
          <div className="li" key={r.id}><time>{fmtDT(r.created_at)}</time><span className={`pill ${(LAB[r.kind] || ["", "off"])[1]}`}>{(LAB[r.kind] || [r.kind])[0]}</span><span>{r.text}</span></div>
        )) : <div className="empty">Sin actividad todavía.</div>}
      </div></div>
    </>
  );
}
