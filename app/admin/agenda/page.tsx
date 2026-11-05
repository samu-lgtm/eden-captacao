import { db } from "@/lib/db";
import { getAgenda, AGENDA_TZ } from "@/lib/booking";
import { getConn, googleConfigured, busy } from "@/lib/google";
import { AgendaEditor, GoogleButtons, CancelBooking } from "./AgendaEditor";

interface Booking { id: string; start_at: string; end_at: string; name: string; email: string; phone: string; meet_link: string | null; form_id: string | null }

const MSG: Record<string, [string, string]> = {
  ok: ["ok", "Google Calendar conectado."],
  cancelado: ["warn", "Has cancelado la conexión con Google."],
  error: ["err", "No se pudo conectar con Google. Inténtalo de nuevo."],
  permisos: ["err", "Faltan permisos: al conectar, marca la casilla de acceso al calendario."],
  "sin-config": ["err", "Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel."],
};

export default async function Agenda({ searchParams }: { searchParams: { google?: string } }) {
  const [cfg, conn, { data }, { data: fd }] = await Promise.all([
    getAgenda(),
    getConn(),
    db().from("bookings").select("*").eq("status", "confirmada").gte("end_at", new Date(Date.now() - 3600000).toISOString()).order("start_at").limit(200),
    db().from("forms").select("id,name"),
  ]);
  // Comprobación real: pedimos a Google la ocupación de las próximas 24 h con la conexión guardada.
  let live: string | null = null;
  if (conn) {
    try { await busy(new Date(), new Date(Date.now() + 86400000)); } catch (e) { live = e instanceof Error ? e.message : "Google no responde"; }
  }
  const bookings = (data || []) as Booking[];
  const forms = new Map(((fd || []) as { id: string; name: string }[]).map((f) => [f.id, f.name]));
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: AGENDA_TZ, ...o }).format(new Date(iso));
  const groups = new Map<string, Booking[]>();
  bookings.forEach((b) => { const k = fmt(b.start_at, { weekday: "long", day: "numeric", month: "long" }); groups.set(k, [...(groups.get(k) || []), b]); });
  const msg = searchParams.google ? MSG[searchParams.google] : null;

  return (
    <>
      <div className="top"><h1>Agenda</h1>{conn && !live ? <span className="pill ok">Google Calendar conectado · comprobado ahora</span> : conn ? <span className="pill err">Conexión con Google caducada</span> : <span className="pill warn">Google Calendar sin conectar</span>}</div>
      {msg ? <div className={msg[0] === "err" ? "errbox" : "note"} style={{ marginBottom: 14 }}>{msg[1]}</div> : null}
      {live ? <div className="errbox" style={{ marginBottom: 14 }}>Google ya no acepta la conexión guardada, así que los leads no pueden reservar. Pulsa “Desconectar” y vuelve a conectar Google Calendar. Detalle: {live}</div> : null}

      <div className="sets" style={{ marginBottom: 26 }}>
        <div className="card sec"><div><h3>Google Calendar</h3><p>Las reuniones se crean en este calendario con enlace de Meet, y lo que ya tengas ocupado en él no se ofrece a los leads.</p></div><div className="fs">
          {!googleConfigured() ? (
            <div className="note">Falta configurar la app de Google (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel).</div>
          ) : conn ? (
            <div className="muted">Conectado como <b>{conn.email || "cuenta de Google"}</b> desde el {new Date(conn.connected_at).toLocaleDateString("es-ES")}.</div>
          ) : (
            <div className="muted">Aún no está conectado. Mientras tanto, los formularios no muestran la agenda.</div>
          )}
          {googleConfigured() ? <GoogleButtons connected={!!conn} /> : null}
        </div></div>
      </div>

      <h2 style={{ marginBottom: 12 }}>Próximas reuniones</h2>
      {!bookings.length ? <div className="card empty" style={{ marginBottom: 26 }}>No hay reuniones reservadas.</div> : (
        <div style={{ marginBottom: 26 }}>
          {Array.from(groups.entries()).map(([day, list]) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <div className="folder" style={{ textTransform: "capitalize" }}>{day}</div>
              <div className="flist">{list.map((b) => (
                <div key={b.id} className="card fitem" style={{ cursor: "default" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 10 }}><b style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 500 }}>{fmt(b.start_at, { hour: "2-digit", minute: "2-digit" })}</b><span style={{ fontSize: 15 }}>{b.name}</span></div>
                    <div className="row muted" style={{ fontSize: 12, marginTop: 4, gap: 12 }}><span>{b.email}</span><span>{b.phone}</span>{b.form_id ? <span>{forms.get(b.form_id)}</span> : null}{b.meet_link ? <a href={b.meet_link} target="_blank" rel="noopener noreferrer">Meet</a> : null}</div>
                  </div>
                  <CancelBooking id={b.id} />
                </div>
              ))}</div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginBottom: 12 }}>Disponibilidad</h2>
      <AgendaEditor initial={cfg} />
    </>
  );
}
