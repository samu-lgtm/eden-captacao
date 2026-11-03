"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

const T = {
  es: {
    title: "Elige día y hora para tu reunión", sub: (m: number, tz: string) => `${m} minutos por Google Meet · horario de ${tz}`,
    loading: "Cargando horarios…", none: "Ahora mismo no hay horarios libres. Te escribimos en menos de 24 horas para buscar uno.",
    error: "No hemos podido cargar la agenda. Te escribimos en menos de 24 horas.", confirm: "Confirmar reunión", booking: "Reservando…",
    skip: "Prefiero que me contactéis", done: "Reunión confirmada", sent: "Te hemos enviado la invitación con el enlace de Meet a tu e-mail.",
    taken: "Ese horario se acaba de ocupar. Elige otro, por favor.", fail: "No hemos podido reservar. Inténtalo de nuevo.",
    tzName: { "Europe/Madrid": "España", "America/Sao_Paulo": "Brasilia" } as Record<string, string>,
  },
  pt: {
    title: "Escolha o dia e o horário da sua reunião", sub: (m: number, tz: string) => `${m} minutos pelo Google Meet · horário de ${tz}`,
    loading: "Carregando horários…", none: "No momento não há horários livres. Entraremos em contato em até 24 horas para combinar.",
    error: "Não conseguimos carregar a agenda. Entraremos em contato em até 24 horas.", confirm: "Confirmar reunião", booking: "Reservando…",
    skip: "Prefiro que vocês entrem em contato", done: "Reunião confirmada", sent: "Enviamos o convite com o link do Meet para o seu e-mail.",
    taken: "Esse horário acabou de ser ocupado. Escolha outro, por favor.", fail: "Não conseguimos reservar. Tente de novo.",
    tzName: { "Europe/Madrid": "Espanha", "America/Sao_Paulo": "Brasília" } as Record<string, string>,
  },
};

export function Booking({ lang, r, t, tz, onSkip, onBooked }: {
  lang: "es" | "pt"; r: string; t: string; tz: string;
  onSkip: () => void; onBooked: (eventId: string) => void;
}) {
  const L = T[lang];
  const loc = lang === "es" ? "es-ES" : "pt-BR";
  const [slots, setSlots] = useState<string[] | null>(null);
  const [duration, setDuration] = useState(45);
  const [err, setErr] = useState("");
  const [day, setDay] = useState("");
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await fetch(`/api/slots?r=${encodeURIComponent(r)}&t=${encodeURIComponent(t)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error();
      setDuration(j.duration); setSlots(j.slots);
    } catch { setErr(L.error); setSlots([]); }
  }, [r, t, L.error]);
  useEffect(() => { load(); }, [load]);

  const dk = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: tz }), [tz]);
  const days = useMemo(() => {
    const m = new Map<string, string[]>();
    (slots || []).forEach((s) => { const k = dk.format(new Date(s)); m.set(k, [...(m.get(k) || []), s]); });
    return m;
  }, [slots, dk]);
  useEffect(() => { if (!day && days.size) setDay(Array.from(days.keys())[0]); }, [days, day]);

  const fDay = (k: string) => {
    const d = new Date(`${k}T12:00:00Z`);
    return {
      wd: new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" }).format(d).replace(".", ""),
      n: new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "UTC" }).format(d),
      mo: new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" }).format(d).replace(".", ""),
    };
  };
  const fTime = (iso: string) => new Intl.DateTimeFormat(loc, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const fFull = (iso: string) => new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  async function book() {
    if (!sel) return;
    setBusy(true); setErr("");
    const eventId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const cookie = (n: string) => document.cookie.split("; ").find((c) => c.startsWith(n + "="))?.split("=")[1];
    try {
      const res = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ r, t, start: sel, eventId, fbp: cookie("_fbp"), fbc: cookie("_fbc") }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setDone(j.start); onBooked(eventId); return; }
      if (j.taken) { setErr(L.taken); setSel(""); await load(); } else if (res.status === 409 && j.start) { setDone(j.start); }
      else setErr(j.error || L.fail);
    } catch { setErr(L.fail); }
    setBusy(false);
  }

  if (done) {
    return (
      <div>
        <div className="qn">{L.done}</div>
        <div className="q" style={{ textTransform: "none" }}>{fFull(done)}</div>
        <p className="consent">{L.sent}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="qn">{L.sub(duration, L.tzName[tz] || tz)}</div>
      <div className="q">{L.title}</div>
      {slots === null ? <p className="hint">{L.loading}</p> : !days.size ? (
        <>
          <p className="consent">{err || L.none}</p>
          <div className="pubnav"><button className="pbtn alt" type="button" onClick={onSkip}>OK</button></div>
        </>
      ) : (
        <>
          <div className="days" role="listbox" aria-label="Día">
            {Array.from(days.keys()).map((k) => { const f = fDay(k); return (
              <button key={k} type="button" className={`daypill ${day === k ? "on" : ""}`} onClick={() => { setDay(k); setSel(""); }}>
                <span>{f.wd}</span><b>{f.n}</b><span>{f.mo}</span>
              </button>
            ); })}
          </div>
          <div className="slots">
            {(days.get(day) || []).map((s) => (
              <button key={s} type="button" className={`slot ${sel === s ? "on" : ""}`} onClick={() => setSel(s)}>{fTime(s)}</button>
            ))}
          </div>
          {err ? <div className="perr" role="alert">{err}</div> : null}
          <div className="pubnav">
            <button className="pbtn" type="button" disabled={!sel || busy} onClick={book}>{busy ? L.booking : L.confirm}</button>
            <button className="pbtn alt" type="button" onClick={onSkip}>{L.skip}</button>
          </div>
        </>
      )}
    </div>
  );
}
