const TZ = "Europe/Madrid";
export const fmtDT = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const fmtD = (d: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
export const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
export const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1).replace(".", ",") + "%" : "—");
