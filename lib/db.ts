import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Form } from "./types";
import { DEFAULT_SETTINGS } from "./types";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = (process.env.SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export function normalizeForm(row: Form): Form {
  return { ...row, fields: row.fields || [], settings: { ...DEFAULT_SETTINGS, ...(row.settings || {}) } };
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  const { data } = await db().from("forms").select("*").eq("slug", slug).maybeSingle();
  return data ? normalizeForm(data as Form) : null;
}

export async function getForm(id: string): Promise<Form | null> {
  const { data } = await db().from("forms").select("*").eq("id", id).maybeSingle();
  return data ? normalizeForm(data as Form) : null;
}

export async function logActivity(kind: string, text: string, form_id?: string | null) {
  try {
    await db().from("activity").insert({ kind, text, form_id: form_id || null });
  } catch {
    /* el registro nunca debe romper un envío */
  }
}
