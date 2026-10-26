"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Field, FieldType, Form, FormSettings } from "@/lib/types";
import { FIELD_TYPES } from "@/lib/types";
import { Question } from "@/components/Question";
import { TabBar, Tab } from "./TabBar";
import { setDirty } from "@/lib/dirty";

const newId = () => Math.random().toString(36).slice(2, 8);

export default function FormEditor({ initial, tab: initialTab }: { initial: Form; tab: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [f, setF] = useState<Form>(initial);
  const [sel, setSel] = useState<string>(initial.fields[0]?.id || "");
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [armed, setArmed] = useState(false);
  const dirty = useMemo(() => JSON.stringify(f) !== saved, [f, saved]);

  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setField = (id: string, patch: Partial<Field>) => setF({ ...f, fields: f.fields.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setS = (patch: Partial<FormSettings>) => setF({ ...f, settings: { ...f.settings, ...patch } });
  const move = (id: string, d: number) => {
    const i = f.fields.findIndex((x) => x.id === id), j = i + d;
    if (j < 0 || j >= f.fields.length) return;
    const a = [...f.fields]; [a[i], a[j]] = [a[j], a[i]]; setF({ ...f, fields: a });
  };
  const remove = (id: string) => { if (f.fields.length <= 1) return; setF({ ...f, fields: f.fields.filter((x) => x.id !== id) }); setSel(""); };
  const add = (type: FieldType) => {
    const nf: Field = { id: newId(), type, label: type === "consent" ? "Protección de datos" : "Nueva pregunta", required: true };
    if (type === "select") nf.options = ["Opción A", "Opción B"];
    if (type === "consent") nf.text = "Acepto el tratamiento de mis datos según la política de privacidad.";
    const ci = f.fields.findIndex((x) => x.type === "consent");
    const a = [...f.fields];
    if (ci >= 0 && type !== "consent") a.splice(ci, 0, nf); else a.push(nf);
    setF({ ...f, fields: a }); setSel(nf.id);
  };

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/admin/forms/${f.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: j.error || "No se pudo guardar." }); return; }
    const next = { ...f, slug: j.slug || f.slug };
    setF(next); setSaved(JSON.stringify(next));
    setMsg({ ok: true, text: "Guardado" });
    router.refresh();
  }
  async function del() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    const r = await fetch(`/api/admin/forms/${f.id}`, { method: "DELETE" });
    if (r.ok) { setSaved(JSON.stringify(f)); router.push("/admin"); } else setMsg({ ok: false, text: "No se pudo eliminar." });
  }

  const s = f.settings;
  const cur = f.fields.find((x) => x.id === sel);
  const ci = cur ? f.fields.indexOf(cur) : 0;
  const words = (t: string) => t.trim().split(/\s+/).length;

  return (
    <>
      <TabBar id={f.id} tab={tab} onLocal={setTab} />

      {tab === "editor" ? (
        <div className="ed">
          <div>
            <div className="fields">
              {f.fields.map((x, i) => (
                <div key={x.id} className={`card fld ${x.id === sel ? "sel" : ""}`} onClick={(e) => { if (!(e.target as HTMLElement).closest("button,input,textarea,select,label")) setSel(x.id); }}>
                  <span className="n">{i + 1}</span>
                  <div style={{ minWidth: 0 }}><div className="t">{x.label}{x.required ? " *" : ""}</div><div className="k">{FIELD_TYPES[x.type]}</div></div>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="ib" aria-label="Subir" onClick={() => move(x.id, -1)}>↑</button>
                    <button className="ib" aria-label="Bajar" onClick={() => move(x.id, 1)}>↓</button>
                    <button className="ib" aria-label="Eliminar" onClick={() => remove(x.id)} disabled={f.fields.length <= 1}>✕</button>
                  </div>
                  {x.id === sel ? (
                    <div className="fedit">
                      <label className="lbl">Pregunta<input className="inp" value={x.label} onChange={(e) => setField(x.id, { label: e.target.value })} /></label>
                      {x.type === "select" ? (
                        <label className="lbl">Opciones (una por línea)
                          <textarea className="inp" value={(x.options || []).join("\n")} onChange={(e) => setField(x.id, { options: e.target.value.split("\n") })} />
                        </label>
                      ) : null}
                      {x.type === "consent" ? (
                        <label className="lbl">Texto de consentimiento<textarea className="inp" value={x.text || ""} onChange={(e) => setField(x.id, { text: e.target.value })} /></label>
                      ) : null}
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <label className="chk"><input type="checkbox" checked={x.required} onChange={(e) => setField(x.id, { required: e.target.checked })} />Obligatoria</label>
                        <label className="lbl" style={{ gridAutoFlow: "column", alignItems: "center" }}>Tipo
                          <select className="inp" style={{ width: "auto" }} value={x.type} onChange={(e) => {
                            const type = e.target.value as FieldType;
                            setField(x.id, { type, options: type === "select" ? x.options || ["Opción A", "Opción B"] : x.options, text: type === "consent" ? x.text || "Acepto el tratamiento de mis datos." : x.text });
                          }}>{Object.entries(FIELD_TYPES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                        </label>
                      </div>
                      {words(x.label) > 15 ? <div className="note">Esta pregunta tiene {words(x.label)} palabras. Las de menos de 15 suelen convertir mejor.</div> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="card addbar">
              <span className="muted" style={{ fontSize: 12, width: "100%" }}>Añadir pregunta</span>
              {Object.entries(FIELD_TYPES).map(([k, n]) => <button key={k} className="btn sm" onClick={() => add(k as FieldType)}>+ {n}</button>)}
            </div>
          </div>
          <div className="preview">
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 8 }}>Vista previa · pregunta {ci + 1} de {f.fields.length}</div>
            <div className="phone">{cur ? <Question field={{ ...cur, options: (cur.options || []).filter((o) => o.trim()) }} index={ci} value={undefined} preview lang={f.lang} privacyUrl={s.privacy_url} /> : <span className="hint">Selecciona una pregunta.</span>}</div>
          </div>
        </div>
      ) : (
        <div className="sets">
          <div className="card sec"><div><h3>General</h3><p>Nombre, dirección pública e idioma de los botones.</p></div><div className="fs">
            <label className="lbl">Nombre<input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <div className="two">
              <label className="lbl">Dirección (formulario.edenperformance.net/…)<input className="inp" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label>
              <label className="lbl">Carpeta<input className="inp" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} /></label>
            </div>
            <div className="two">
              <label className="lbl">Estado<select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Form["status"] })}><option value="ativo">Activo (recibe leads)</option><option value="pausado">En pausa</option></select></label>
              <label className="lbl">Idioma<select className="inp" value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value as Form["lang"] })}><option value="es">Español</option><option value="pt">Portugués</option></select></label>
            </div>
          </div></div>

          <div className="card sec"><div><h3>Después del envío</h3><p>Lo que ve el lead al terminar.</p></div><div className="fs">
            <label className="lbl">Mensaje de agradecimiento<input className="inp" value={s.thanks} onChange={(e) => setS({ thanks: e.target.value })} /></label>
            <label className="lbl">Redirigir a un enlace (opcional)<input className="inp" placeholder="https://" value={s.redirect_url} onChange={(e) => setS({ redirect_url: e.target.value })} /></label>
            <label className="lbl">Política de privacidad<input className="inp" value={s.privacy_url} onChange={(e) => setS({ privacy_url: e.target.value })} /></label>
          </div></div>

          <div className="card sec"><div><h3>Meta Ads</h3><p>El Pixel se dispara en el navegador si el lead acepta las cookies. La Conversions API envía el lead desde el servidor siempre, con el mismo ID de evento para que Meta no lo cuente dos veces.</p></div><div className="fs">
            <div className="two">
              <label className="lbl">ID del píxel / conjunto de datos<input className="inp mono" value={s.pixel_id} onChange={(e) => setS({ pixel_id: e.target.value })} /></label>
              <label className="lbl">Evento<select className="inp" value={s.event_name} onChange={(e) => setS({ event_name: e.target.value })}>{["Lead", "CompleteRegistration", "Contact", "SubmitApplication"].map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
            <label className="lbl">Token de acceso de la Conversions API<input className="inp mono" type="password" autoComplete="off" value={s.capi_token} onChange={(e) => setS({ capi_token: e.target.value })} placeholder="Se genera en el Administrador de eventos" /></label>
            <label className="lbl">Código de prueba (opcional, para Probar eventos)<input className="inp mono" value={s.test_event_code} onChange={(e) => setS({ test_event_code: e.target.value })} placeholder="TEST12345" /></label>
            <div className="note">Se envían cifrados en SHA-256: e-mail, teléfono, nombre y país, además de fbp/fbc, IP y navegador. Quita el código de prueba antes de activar las campañas.</div>
          </div></div>

          <div className="card sec"><div><h3>Avisos</h3><p>Quién se entera cuando entra un lead.</p></div><div className="fs">
            <label className="chk"><input type="checkbox" checked={s.notify_email} onChange={(e) => setS({ notify_email: e.target.checked })} />E-mail al responsable</label>
            {s.notify_email ? <label className="lbl">Destinatarios (separados por coma)<input className="inp" value={s.notify_to} onChange={(e) => setS({ notify_to: e.target.value })} /></label> : null}
            <label className="chk"><input type="checkbox" checked={s.auto_reply} onChange={(e) => setS({ auto_reply: e.target.checked })} />Confirmación automática por e-mail al lead</label>
          </div></div>

          <div className="row"><button className="btn danger" onClick={del}>{armed ? "Pulsa otra vez para eliminar con todas las respuestas" : "Eliminar formulario"}</button></div>
        </div>
      )}

      <div className="savebar">
        <button className="btn pri" onClick={save} disabled={busy || !dirty}>{busy ? "Guardando…" : "Guardar cambios"}</button>
        {dirty ? <span className="pill warn">Cambios sin guardar</span> : null}
        {msg ? <span className={msg.ok ? "pill ok" : "errbox"}>{msg.text}</span> : null}
      </div>
    </>
  );
}
