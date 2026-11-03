"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AgendaConfig } from "@/lib/booking";
import { setDirty } from "@/lib/dirty";

const DAYS: [string, string][] = [["1", "Lunes"], ["2", "Martes"], ["3", "Miércoles"], ["4", "Jueves"], ["5", "Viernes"], ["6", "Sábado"], ["7", "Domingo"]];

export function GoogleButtons({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  return (
    <div className="row">
      <a className={`btn ${connected ? "" : "pri"}`} href="/api/admin/google/connect">{connected ? "Reconectar" : "Conectar Google Calendar"}</a>
      {connected ? <button className="btn danger" onClick={async () => {
        if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return; }
        await fetch("/api/admin/google/disconnect", { method: "POST" }); router.refresh();
      }}>{armed ? "Pulsa otra vez para desconectar" : "Desconectar"}</button> : null}
    </div>
  );
}

export function CancelBooking({ id }: { id: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="row" style={{ flexWrap: "nowrap" }}>
      {msg ? <span className="errbox">{msg}</span> : null}
      <button className="btn sm danger" onClick={async () => {
        if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return; }
        const r = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) setMsg(j.error || "No se pudo cancelar."); else router.refresh();
      }}>{armed ? "Confirmar cancelación" : "Cancelar"}</button>
    </div>
  );
}

export function AgendaEditor({ initial }: { initial: AgendaConfig }) {
  const router = useRouter();
  const [c, setC] = useState<AgendaConfig>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = useMemo(() => JSON.stringify(c) !== saved, [c, saved]);
  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty]);

  const setRange = (d: string, i: number, p: 0 | 1, v: string) => {
    const r = (c.ranges[d] || []).map((x) => [...x] as [string, string]); r[i][p] = v; setC({ ...c, ranges: { ...c.ranges, [d]: r } });
  };
  const toggleDay = (d: string, on: boolean) => {
    const ranges = { ...c.ranges };
    if (on) ranges[d] = [["09:00", "13:00"], ["15:00", "18:00"]]; else delete ranges[d];
    setC({ ...c, ranges });
  };
  const addRange = (d: string) => { const r = [...(c.ranges[d] || [])]; const last = r[r.length - 1]; r.push(last ? [last[1], last[1] < "18:00" ? "19:00" : "20:00"] : ["09:00", "13:00"]); setC({ ...c, ranges: { ...c.ranges, [d]: r } }); };
  const rmRange = (d: string, i: number) => { const r = (c.ranges[d] || []).filter((_, k) => k !== i); const ranges = { ...c.ranges }; if (r.length) ranges[d] = r; else delete ranges[d]; setC({ ...c, ranges }); };

  async function save() {
    setMsg(null);
    const r = await fetch("/api/admin/agenda", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ ok: false, text: j.error || "No se pudo guardar." }); return; }
    setSaved(JSON.stringify(c)); setMsg({ ok: true, text: "Guardado" }); router.refresh();
  }

  return (
    <div className="sets">
      <div className="card sec"><div><h3>Reunión</h3><p>Lo que ve el lead y cómo queda en tu calendario.</p></div><div className="fs">
        <div className="two">
          <label className="lbl">Nombre de la reunión · España<input className="inp" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} /></label>
          <label className="lbl">Nombre de la reunión · Brasil<input className="inp" value={c.title_pt} onChange={(e) => setC({ ...c, title_pt: e.target.value })} /></label>
        </div>
        <div className="two">
          <label className="lbl">Duración<select className="inp" value={c.duration} onChange={(e) => setC({ ...c, duration: Number(e.target.value) })}>{[15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
          <label className="lbl">Margen entre reuniones<select className="inp" value={c.buffer} onChange={(e) => setC({ ...c, buffer: Number(e.target.value) })}>{[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
        </div>
        <div className="two">
          <label className="lbl">Antelación mínima<select className="inp" value={c.notice} onChange={(e) => setC({ ...c, notice: Number(e.target.value) })}>{[1, 2, 4, 12, 24, 48].map((h) => <option key={h} value={h}>{h} h</option>)}</select></label>
          <label className="lbl">Días que ve el lead<select className="inp" value={c.max_days} onChange={(e) => setC({ ...c, max_days: Number(e.target.value) })}>{[3, 4, 5, 7, 10].map((d) => <option key={d} value={d}>Los próximos {d} días con hueco</option>)}</select></label>
        </div>
        <label className="lbl">Leads de Brasil: primera hora que se les ofrece (hora de Brasilia)<input className="inp" type="time" style={{ maxWidth: 140 }} value={c.br_from} onChange={(e) => setC({ ...c, br_from: e.target.value })} /></label>
        <label className="lbl">Aviso de nueva reunión por e-mail a<input className="inp" value={c.notify_to} onChange={(e) => setC({ ...c, notify_to: e.target.value })} /></label>
      </div></div>

      <div className="card sec"><div><h3>Horario</h3><p>Hora de Madrid. A los leads de Brasil se les muestra convertido a su hora.</p></div><div style={{ display: "grid", gap: 4 }}>
        {DAYS.map(([d, name]) => {
          const r = c.ranges[d] || [];
          return (
            <div key={d} className="row" style={{ alignItems: "center", padding: "8px 0", borderTop: d === "1" ? "0" : "1px solid var(--rule)", gap: 12 }}>
              <label className="chk" style={{ width: 110 }}><input type="checkbox" checked={!!r.length} onChange={(e) => toggleDay(d, e.target.checked)} />{name}</label>
              <div className="row" style={{ gap: 8 }}>
                {r.length ? r.map((x, i) => (
                  <span key={i} className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                    <input className="inp" type="time" style={{ width: 96 }} value={x[0]} onChange={(e) => setRange(d, i, 0, e.target.value)} />
                    <span className="muted">–</span>
                    <input className="inp" type="time" style={{ width: 96 }} value={x[1]} onChange={(e) => setRange(d, i, 1, e.target.value)} />
                    <button className="ib" aria-label="Quitar tramo" onClick={() => rmRange(d, i)}>✕</button>
                  </span>
                )) : <span className="muted" style={{ fontSize: 12.5 }}>No disponible</span>}
                {r.length ? <button className="btn sm" onClick={() => addRange(d)}>+ Tramo</button> : null}
              </div>
            </div>
          );
        })}
      </div></div>

      <div className="savebar">
        <button className="btn pri" onClick={save} disabled={!dirty}>Guardar disponibilidad</button>
        {dirty ? <span className="pill warn">Cambios sin guardar</span> : null}
        {msg ? <span className={msg.ok ? "pill ok" : "errbox"}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
