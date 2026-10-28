import Link from "next/link";
import { notFound } from "next/navigation";
import { db, getForm } from "@/lib/db";
import type { Form, ResponseRow } from "@/lib/types";
import { fmtDT, fmtD, dayKey, pct } from "@/lib/fmt";
import FormEditor from "./FormEditor";
import { ResendButton, CopyCsv, DuplicateButton } from "./Actions";
import { TabBar } from "./TabBar";

type Tab = "editor" | "config" | "respuestas" | "insights";

function Header({ form }: { form: Form }) {
  const base = process.env.PUBLIC_BASE_URL || "";
  const link = `${base}/${form.slug}`;
  return (
    <div className="top">
      <div>
        <div className="crumb"><Link href="/admin">Formularios</Link>{form.folder ? ` / ${form.folder}` : ""}</div>
        <h1>{form.name}</h1>
      </div>
      <div className="row">
        <span className="slug">{link.replace(/^https?:\/\//, "")}</span>
        <DuplicateButton id={form.id} />
        <a className="btn pri" href={`/${form.slug}${form.status === "ativo" ? "" : "?preview=1"}`} target="_blank" rel="noopener noreferrer">Abrir formulario</a>
      </div>
    </div>
  );
}

export default async function FormPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; days?: string } }) {
  const form = await getForm(params.id);
  if (!form) notFound();
  const tab = (["editor", "config", "respuestas", "insights"].includes(searchParams.tab || "") ? searchParams.tab : "editor") as Tab;

  if (tab === "editor" || tab === "config") {
    return (<><Header form={form} /><FormEditor initial={form} tab={tab} /></>);
  }

  if (tab === "respuestas") {
    const { data } = await db().from("responses").select("*").eq("form_id", form.id).order("created_at", { ascending: false }).limit(500);
    const rs = (data || []) as ResponseRow[];
    const cols = form.fields.filter((f) => f.type !== "consent");
    const csv = [
      ["Recibido", ...form.fields.map((f) => f.label), "Meta", "Origen"].join(";"),
      ...rs.map((r) => [fmtDT(r.created_at), ...form.fields.map((f) => String(r.answers[f.id] ?? "").replace(/[;\n]/g, " ")), r.meta_status, Object.values(r.source || {}).join(" ")].join(";")),
    ].join("\n");
    return (
      <>
        <Header form={form} /><TabBar id={form.id} tab={tab} />
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <span className="muted">{rs.length} leads{rs.length === 500 ? " (últimos 500)" : ""}</span>
          {rs.length ? <CopyCsv csv={csv} /> : null}
        </div>
        {!rs.length ? <div className="card empty">Todavía no hay respuestas.</div> : (
          <div className="card tw"><table>
            <thead><tr><th>Recibido</th>{cols.map((c) => <th key={c.id}>{c.label.length > 26 ? c.label.slice(0, 24) + "…" : c.label}</th>)}<th>Meta</th><th>Origen</th></tr></thead>
            <tbody>{rs.map((r) => (
              <tr key={r.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDT(r.created_at)}</td>
                {cols.map((c) => <td key={c.id}>{String(r.answers[c.id] ?? "")}</td>)}
                <td>{r.meta_status === "enviado" ? <span className="pill ok">Enviado</span> : r.meta_status === "erro"
                  ? <span title={r.meta_error || ""}><span className="pill err">Falló</span> <ResendButton id={r.id} /></span>
                  : <span className="pill off">No configurado</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{[r.source?.utm_source, r.source?.utm_campaign].filter(Boolean).join(" · ") || (r.source?.fbclid ? "Meta (fbclid)" : "Directo")}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </>
    );
  }

  // insights
  const days = [7, 30, 90].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data: evs }, { data: rsd }] = await Promise.all([
    db().from("form_events").select("session,kind,step").eq("form_id", form.id).gte("created_at", since).limit(50000),
    db().from("responses").select("created_at").eq("form_id", form.id).gte("created_at", since).limit(10000),
  ]);
  const events = (evs || []) as { session: string; kind: string; step: number }[];
  const views = new Set(events.filter((e) => e.kind === "view").map((e) => e.session)).size;
  const maxBy = new Map<string, number>();
  events.filter((e) => e.kind === "step").forEach((e) => maxBy.set(e.session, Math.max(maxBy.get(e.session) || 0, e.step)));
  const starts = maxBy.size;
  const sent = (rsd || []).length;
  const F = form.fields.length;
  // reached[i] = sesiones que vieron la pregunta i (la 1 la ven todas las visitas)
  const reached = form.fields.map((_, i) => (i === 0 ? views : Array.from(maxBy.values()).filter((m) => m >= i).length));
  const span = Math.min(days, 30);
  const daily = Array.from({ length: span }, (_, k) => {
    const d = new Date(Date.now() - (span - 1 - k) * 86400000);
    return { d, c: (rsd || []).filter((r: { created_at: string }) => dayKey(new Date(r.created_at)) === dayKey(d)).length };
  });
  const max = Math.max(2, ...daily.map((x) => x.c));
  const W = 640, H = 170, L = 26, B = 24, Tp = 10, bw = (W - L - 8) / span;
  const longQ = form.fields.filter((f) => f.label.split(/\s+/).length > 15);

  return (
    <>
      <Header form={form} /><TabBar id={form.id} tab={tab} />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div className="periods">{[7, 30, 90].map((d) => <Link key={d} href={`/admin/forms/${form.id}?tab=insights&days=${d}`} className={d === days ? "on" : ""}>{d} días</Link>)}</div>
      </div>
      <div className="kpis">
        <div className="card kpi"><span>Visitas</span><b>{views}</b></div>
        <div className="card kpi"><span>Empezaron</span><b>{starts}</b></div>
        <div className="card kpi"><span>Enviaron</span><b>{sent}</b></div>
        <div className="card kpi"><span>Conversión</span><b>{pct(sent, views)}</b></div>
      </div>
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}><h3>Leads por día</h3><span className="muted" style={{ fontSize: 12 }}>últimos {span} días</span></div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Leads por día">
          {[0, Math.ceil(max / 2), max].map((t) => { const y = H - B - (t / max) * (H - B - Tp); return <g key={t}><line x1={L} x2={W} y1={y} y2={y} stroke="var(--rule)" /><text x={L - 6} y={y + 3} textAnchor="end">{t}</text></g>; })}
          {daily.map((x, k) => { const h = (x.c / max) * (H - B - Tp); const X = L + 4 + k * bw; return <g key={k}><rect x={X + bw * 0.18} y={H - B - h} width={bw * 0.64} height={h} rx={2} fill="var(--leaf)"><title>{`${fmtD(x.d)}: ${x.c}`}</title></rect>{k % Math.ceil(span / 7) === 0 || k === span - 1 ? <text x={X + bw / 2} y={H - 8} textAnchor="middle">{fmtD(x.d)}</text> : null}</g>; })}
        </svg>
      </div>
      {longQ.length ? <div className="note" style={{ marginBottom: 16 }}>{longQ.length} pregunta(s) con más de 15 palabras. Las preguntas cortas suelen convertir mejor.</div> : null}
      <div className="card tw"><table>
        <thead><tr><th>#</th><th>Pregunta</th><th>La vieron</th><th style={{ minWidth: 140 }}>Retención</th><th>Abandono</th></tr></thead>
        <tbody>{form.fields.map((f, i) => {
          const nx = i < F - 1 ? reached[i + 1] : sent;
          const drop = reached[i] ? 1 - nx / reached[i] : 0;
          return <tr key={f.id}><td className="muted">{i + 1}</td><td>{f.label}</td><td>{reached[i]}</td>
            <td><div className="bar"><i style={{ width: `${views ? (reached[i] / views) * 100 : 0}%` }} /></div></td>
            <td style={{ color: drop > 0.15 ? "var(--err)" : undefined }}>{reached[i] ? `${Math.max(0, Math.round(drop * 100))}%` : "—"}</td></tr>;
        })}</tbody>
      </table></div>
    </>
  );
}
