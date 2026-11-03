// Conversión entre hora local de una zona (Europe/Madrid, America/Sao_Paulo…) y UTC, sin librerías.
const fmts = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmts.set(tz, f);
  }
  return f;
}

/** Partes de fecha/hora de un instante en una zona. */
export function partsIn(date: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const x of fmt(tz).formatToParts(date)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}

/** Minutos que la zona va por delante de UTC en ese instante. */
export function offsetMin(date: Date, tz: string) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Hora local (y, m, d, h, min) en la zona → instante UTC. */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const o1 = offsetMin(new Date(guess), tz);
  let t = guess - o1 * 60000;
  const o2 = offsetMin(new Date(t), tz);
  if (o2 !== o1) t = guess - o2 * 60000;
  return new Date(t);
}

export const dateKeyIn = (date: Date, tz: string) => {
  const p = partsIn(date, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
};
