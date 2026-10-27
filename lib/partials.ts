import "server-only";
import { db } from "./db";

export const PARTIAL_DAYS = 30;

/** Borra los incompletos de más de 30 días. Se llama al guardar y al abrir el panel. */
export async function purgeOldPartials() {
  try {
    const limit = new Date(Date.now() - PARTIAL_DAYS * 86400000).toISOString();
    await db().from("partials").delete().lt("updated_at", limit);
  } catch {
    /* nunca bloquea */
  }
}
