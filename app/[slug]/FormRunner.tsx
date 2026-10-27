"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicForm } from "@/lib/types";
import { Question } from "@/components/Question";
import { Logo } from "@/components/Logo";
import { Intro } from "@/components/Intro";

type Fbq = ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

const T = {
  es: { next: "Continuar", send: "Enviar", back: "Atrás", enter: "o pulsa Enter ↵", req: "Esta pregunta es obligatoria.", consent: "Para continuar, acepta el tratamiento de los datos.", email: "Ese e-mail parece incompleto. Revísalo.", phone: "Incluye el número completo.", sending: "Enviando…", done: "Enviado", fail: "No hemos podido enviar tus datos. Inténtalo de nuevo.", paused: "Vista previa: este formulario está en pausa y los envíos no se guardan.",
    cookie: "Usamos cookies de Meta para medir nuestras campañas. Puedes aceptarlas o seguir sin ellas.", accept: "Aceptar", reject: "Rechazar", policy: "Más información" },
  pt: { next: "Continuar", send: "Enviar", back: "Voltar", enter: "ou pressione Enter ↵", req: "Esta pergunta é obrigatória.", consent: "Para continuar, aceite o tratamento dos dados.", email: "Esse e-mail parece incompleto. Confira.", phone: "Inclua o número completo, com DDD.", sending: "Enviando…", done: "Enviado", fail: "Não conseguimos enviar seus dados. Tente de novo.", paused: "Pré-visualização: este formulário está pausado e os envios não são salvos.",
    cookie: "Usamos cookies da Meta para medir nossas campanhas. Você pode aceitar ou seguir sem elas.", accept: "Aceitar", reject: "Recusar", policy: "Saiba mais" },
};

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const cookie = (n: string) => document.cookie.split("; ").find((c) => c.startsWith(n + "="))?.split("=")[1];
const store = { get(k: string) { try { return localStorage.getItem(k); } catch { return null; } }, set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* */ } } };

function loadPixel(id: string) {
  if (window.fbq) return;
  const n: Fbq = function (...args: unknown[]) { n.callMethod ? n.callMethod(...args) : (n.queue as unknown[]).push(args); } as Fbq;
  window.fbq = n; window._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  n("init", id);
  n("track", "PageView");
}

export default function FormRunner({ form, live }: { form: PublicForm; live: boolean }) {
  const t = T[form.lang];
  const F = form.fields;
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<string, string | boolean>>({});
  const [err, setErr] = useState("");
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const [consent, setConsent] = useState<"yes" | "no" | null>(null);
  const [onIntro, setOnIntro] = useState(!!form.intro);
  const session = useRef("");
  const started = useRef(Date.now());
  const maxStep = useRef(0);
  const hp = useRef<HTMLInputElement>(null);
  const source = useRef<Record<string, string>>({});

  const track = useCallback((kind: "view" | "step", step = 0) => {
    if (!live) return;
    const body = JSON.stringify({ formId: form.id, session: session.current, kind, step });
    try { navigator.sendBeacon ? navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" })) : fetch("/api/track", { method: "POST", body, keepalive: true }); } catch { /* */ }
  }, [form.id, live]);

  useEffect(() => {
    session.current = rid().replace(/[^\w-]/g, "").slice(0, 40);
    const q = new URLSearchParams(location.search);
    q.forEach((v, k) => { if (/^(utm_[a-z]+|fbclid|ref)$/.test(k)) source.current[k] = v; });
    track("view");
    const c = store.get("eden_cookies");
    if (c === "yes" || c === "no") setConsent(c);
  }, [track]);

  useEffect(() => { if (consent === "yes" && form.pixel_id) loadPixel(form.pixel_id); }, [consent, form.pixel_id]);

  const x = F[i];
  // Si la siguiente pregunta es el consentimiento, va como casilla en esta misma pantalla.
  const att = x && x.type !== "consent" && F[i + 1]?.type === "consent" ? F[i + 1] : null;
  const stepAfter = att ? i + 2 : i + 1;
  // Incompletos: el aviso va en el primer dato de contacto y solo se guarda a partir de ahí.
  const contactIdx = F.findIndex((f) => f.type === "email" || f.type === "phone");

  const submit = useCallback(async (final: Record<string, string | boolean>) => {
    setState("sending");
    const eventId = rid();
    let fbc = cookie("_fbc");
    if (!fbc && source.current.fbclid) fbc = `fb.1.${Date.now()}.${source.current.fbclid}`;
    if (!live) { setTimeout(() => setState("done"), 500); return; }
    try {
      const res = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: form.id, session: session.current, answers: final, eventId, hp: hp.current?.value || "", elapsed: Date.now() - started.current, fbp: cookie("_fbp"), fbc, url: location.href.split("?")[0], source: source.current }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.error || t.fail); setState("form"); return; }
      if (consent === "yes" && window.fbq) window.fbq("track", form.event_name, {}, { eventID: eventId });
      if (j.redirect) { setTimeout(() => { location.href = j.redirect; }, 400); }
      setState("done");
    } catch {
      setErr(t.fail); setState("form");
    }
  }, [consent, form.event_name, form.id, live, t.fail]);

  const next = useCallback((override?: Record<string, string | boolean>) => {
    const a = override || ans;
    const v = a[x.id];
    const empty = v === undefined || v === "" || v === false;
    if (x.required && empty) { setErr(x.type === "consent" ? t.consent : t.req); return; }
    if (!empty && x.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) { setErr(t.email); return; }
    if (!empty && x.type === "phone" && String(v).replace(/\D/g, "").length < 8) { setErr(t.phone); return; }
    if (att && att.required && a[att.id] !== true) { setErr(t.consent); return; }
    setErr("");
    if (stepAfter > maxStep.current) {
      for (let k = maxStep.current + 1; k <= stepAfter; k++) track("step", k);
      maxStep.current = stepAfter;
    }
    if (stepAfter < F.length) {
      if (form.partial && live && contactIdx >= 0 && stepAfter > contactIdx) {
        const body = JSON.stringify({ formId: form.id, session: session.current, answers: a, step: stepAfter });
        fetch("/api/partial", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
      setI(stepAfter);
    } else submit(a);
  }, [ans, x, att, stepAfter, F.length, submit, t, track, form.partial, form.id, live, contactIdx]);

  const pick = (v: string | boolean) => {
    const a = { ...ans, [x.id]: v };
    setAns(a); setErr("");
    // Con casilla de consentimiento en la pantalla no se avanza solo: el lead la marca y pulsa Enviar.
    if (v !== false && !att) setTimeout(() => next(a), 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state !== "form" || onIntro) return;
      const target = e.target as HTMLElement;
      if (e.key === "Enter" && !e.shiftKey && !(target.tagName === "TEXTAREA")) { e.preventDefault(); next(); return; }
      if ((x.type === "select" || x.type === "consent") && target.tagName !== "INPUT" && /^[a-z]$/i.test(e.key)) {
        const k = e.key.toUpperCase().charCodeAt(0) - 65;
        if (x.type === "select" && x.options && x.options[k]) pick(x.options[k]);
        if (x.type === "consent" && k === 0) pick(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setCookie = (c: "yes" | "no") => { store.set("eden_cookies", c); setConsent(c); };

  return (
    <div className="pub">
      {onIntro ? null : <div className="progress"><i style={{ width: `${(state === "done" ? 1 : i / F.length) * 100}%` }} /></div>}
      <div className="pubtop"><Logo />{!live ? <span className="hint">{t.paused}</span> : null}</div>
      <div className="pubwrap">
        {onIntro && form.intro ? (
          <Intro intro={form.intro} onStart={() => { started.current = Date.now(); setOnIntro(false); }} />
        ) : state === "done" ? (
          <div><div className="qn">{t.done}</div><div className="q">{form.thanks}</div></div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
            <input ref={hp} className="hp" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
            <Question key={x.id} field={x} index={i} lang={form.lang} privacyUrl={form.privacy_url} value={ans[x.id]}
              onChange={(v) => { setAns({ ...ans, [x.id]: v }); if (err) setErr(""); }} onPick={pick}
              notice={form.partial && i === contactIdx ? form.partial.notice : null}
              attached={att ? { field: att, value: ans[att.id], onToggle: (c) => { setAns({ ...ans, [att.id]: c }); if (err) setErr(""); } } : null} />
            {err ? <div className="perr" role="alert">{err}</div> : null}
            <div className="pubnav">
              <button className="pbtn" type="submit" disabled={state === "sending"}>{state === "sending" ? t.sending : stepAfter >= F.length ? t.send : t.next}</button>
              {i > 0 ? <button className="pbtn alt" type="button" onClick={() => {
                setErr("");
                const back = i >= 2 && F[i - 1].type === "consent" && F[i - 2].type !== "consent" ? i - 2 : i - 1;
                setI(back);
              }}>{t.back}</button> : null}
              <span className="hint">{t.enter}</span>
            </div>
          </form>
        )}
      </div>
      {form.pixel_id && consent === null ? (
        <div className="cookie" role="dialog" aria-label="Cookies">
          <div>{t.cookie} {form.privacy_url ? <a href={form.privacy_url} target="_blank" rel="noopener noreferrer">{t.policy}</a> : null}</div>
          <div className="row"><button className="pbtn" type="button" onClick={() => setCookie("yes")}>{t.accept}</button><button className="pbtn alt" type="button" onClick={() => setCookie("no")}>{t.reject}</button></div>
        </div>
      ) : null}
    </div>
  );
}
