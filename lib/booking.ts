import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./db";
import { zonedToUtc, partsIn, dateKeyIn } from "./tz";
import { busy as googleBusy, getConn } from "./google";
import type { Form } from "./types";
import { walk } from "./logic";

export const AGENDA_TZ = "Europe/Madrid";
export type Ranges = Record<string, [string, string][]>; // "1".."7" (lunes..domingo) → tramos HH:MM

export interface AgendaConfig {
  title: string; // nombre del evento para leads de España
  title_pt: string; // nombre del evento para leads de Brasil
  duration: number; // minutos
  buffer: number; // minutos libres antes y después
  notice: number; // horas mínimas de antelación
  horizon: number; // días hacia delante
  step: number; // cada cuántos minutos empieza un hueco
  ranges: Ranges;
  notify_to: string;
  max_days: number; // cuántos días con hueco se enseñan como máximo
  br_from: string; // HH:MM: primera hora (de Brasilia) que se ofrece a los leads de Brasil
}

export const BR_TZ = "America/Sao_Paulo";
export const leadTz = (lang: string) => (lang === "pt" ? BR_TZ : AGENDA_TZ);

export const DEFAULT_AGENDA: AgendaConfig = {
  title: "Sesión Estratégica Eden",
  title_pt: "Sessão Estratégica Eden",
  duration: 45,
  buffer: 15,
  notice: 12,
  horizon: 21,
  step: 30,
  ranges: {
    "1": [["09:00", "13:00"], ["15:00", "18:00"]],
    "2": [["09:00", "13:00"], ["15:00", "18:00"]],
    "3": [["09:00", "13:00"], ["15:00", "18:00"]],
    "4": [["09:00", "13:00"], ["15:00", "18:00"]],
    "5": [["09:00", "13:00"], ["15:00", "18:00"]],
  },
  notify_to: "samu@edenperformance.net",
  max_days: 5,
  br_from: "07:30",
};

export async function getAgenda(): Promise<AgendaConfig> {
  const { data } = await db().from("app_settings").select("value").eq("key", "agenda").maybeSingle();
  return { ...DEFAULT_AGENDA, ...((data?.value as Partial<AgendaConfig>) || {}) };
}

/** ¿El lead califica? No ha pasado por ninguna respuesta marcada como "Terminar (no calificado)". */
export function isQualified(form: Form, answers: Record<string, unknown>): boolean {
  return walk(form.fields, answers).qualified;
}

const secret = () => process.env.SESSION_SECRET || "";
export function bookingToken(responseId: string) {
  return createHmac("sha256", secret()).update(`book:${responseId}`).digest("hex").slice(0, 40);
}
export function validToken(responseId: string, token: string) {
  const good = Buffer.from(bookingToken(responseId));
  const got = Buffer.from(String(token || ""));
  return good.length === got.length && timingSafeEqual(good, got);
}

const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

/** Huecos libres (inicio en UTC) teniendo en cuenta horario, Google Calendar, reuniones ya reservadas, antelación y margen. */
export async function freeSlots(cfg: AgendaConfig, tz: string = AGENDA_TZ, now = new Date()): Promise<Date[]> {
  const earliest = now.getTime() + cfg.notice * 3600000;
  const startDay = partsIn(now, AGENDA_TZ);
  const candidates: Date[] = [];
  for (let i = 0; i <= cfg.horizon; i++) {
    const base = new Date(Date.UTC(startDay.y, startDay.m - 1, startDay.d + i));
    const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
    const iso = ((base.getUTCDay() + 6) % 7) + 1; // 1 = lunes … 7 = domingo
    for (const [a, b] of cfg.ranges[String(iso)] || []) {
      for (let t = toMin(a); t + cfg.duration <= toMin(b); t += cfg.step) {
        const s = zonedToUtc(y, m, d, Math.floor(t / 60), t % 60, AGENDA_TZ);
        if (s.getTime() >= earliest) candidates.push(s);
      }
    }
  }
  if (!candidates.length) return [];
  const from = candidates[0];
  const to = new Date(candidates[candidates.length - 1].getTime() + cfg.duration * 60000);

  const blocks: { start: number; end: number }[] = [];
  if (await getConn()) blocks.push(...(await googleBusy(from, to)));
  const { data } = await db().from("bookings").select("start_at,end_at").eq("status", "confirmada").gte("end_at", from.toISOString()).lte("start_at", to.toISOString());
  for (const b of (data || []) as { start_at: string; end_at: string }[]) blocks.push({ start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime() });

  const pad = cfg.buffer * 60000;
  const brFrom = /^\d\d:\d\d$/.test(cfg.br_from || "") ? toMin(cfg.br_from) : 0;
  const free = candidates.filter((s) => {
    const a = s.getTime(), b = a + cfg.duration * 60000;
    if (blocks.some((x) => a < x.end + pad && b > x.start - pad)) return false;
    if (tz === BR_TZ && brFrom) { const p = partsIn(s, BR_TZ); if (p.h * 60 + p.min < brFrom) return false; }
    return true;
  });
  // Solo los primeros N días con hueco (en la hora del lead), para que reserve pronto.
  const days: string[] = [];
  return free.filter((s) => {
    const k = dateKeyIn(s, tz);
    if (!days.includes(k)) { if (days.length >= (cfg.max_days || 5)) return false; days.push(k); }
    return true;
  });
}
