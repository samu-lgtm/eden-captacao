// Sesión del panel: cookie firmada con HMAC. Funciona en el middleware (edge) y en Node.
export const COOKIE = "eden_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

async function hmac(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 16) throw new Error("SESSION_SECRET debe tener al menos 16 caracteres.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeSession(): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return { value: `${exp}.${await hmac(String(exp))}`, maxAge: MAX_AGE };
}

export async function validSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  try {
    const good = await hmac(exp);
    if (good.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
