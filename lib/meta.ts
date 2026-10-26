import "server-only";
import { createHash } from "crypto";
import type { Form, ResponseRow } from "./types";

const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export function normalizePhone(raw: string, lang: "es" | "pt"): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (lang === "es" && d.length === 9) d = "34" + d;
  if (lang === "pt" && (d.length === 10 || d.length === 11)) d = "55" + d;
  return d;
}

function pick(form: Form, answers: ResponseRow["answers"], type: string): string {
  const f = form.fields.find((x) => x.type === type);
  const v = f ? answers[f.id] : "";
  return typeof v === "string" ? v : "";
}

export interface ClientCtx {
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string;
  fbc?: string;
  url?: string;
}

/** Envía el evento a la Conversions API. Mismo event_id que el Pixel → Meta no lo cuenta dos veces. */
export async function sendCapi(
  form: Form,
  response: Pick<ResponseRow, "id" | "answers" | "event_id">,
  ctx: ClientCtx,
  eventName?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { pixel_id, capi_token, test_event_code } = form.settings;
  if (!pixel_id || !capi_token) return { ok: false, error: "Falta el ID del píxel o el token de la Conversions API." };

  const name = pick(form, response.answers, "text").trim();
  const [first, ...rest] = name.split(/\s+/);
  const email = pick(form, response.answers, "email");
  const phone = normalizePhone(pick(form, response.answers, "phone"), form.lang);
  const country = form.lang === "es" ? "es" : "br";

  const user_data: Record<string, unknown> = {
    external_id: [sha(response.id)],
    country: [sha(country)],
  };
  if (email) user_data.em = [sha(email)];
  if (phone) user_data.ph = [sha(phone)];
  if (first) user_data.fn = [sha(first)];
  if (rest.length) user_data.ln = [sha(rest.join(" "))];
  if (ctx.ip) user_data.client_ip_address = ctx.ip;
  if (ctx.userAgent) user_data.client_user_agent = ctx.userAgent;
  if (ctx.fbp) user_data.fbp = ctx.fbp;
  if (ctx.fbc) user_data.fbc = ctx.fbc;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: eventName || form.settings.event_name || "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: response.event_id,
        action_source: "website",
        event_source_url: ctx.url || undefined,
        user_data,
        custom_data: { form_name: form.name, form_slug: form.slug },
      },
    ],
  };
  if (test_event_code) body.test_event_code = test_event_code;

  const version = process.env.META_GRAPH_VERSION || "v23.0";
  try {
    const res = await fetch(`${process.env.META_GRAPH_URL || "https://graph.facebook.com"}/${version}/${encodeURIComponent(pixel_id.replace(/\s/g, ""))}/events?access_token=${encodeURIComponent(capi_token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message || `Meta respondió ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red al contactar con Meta" };
  }
}
