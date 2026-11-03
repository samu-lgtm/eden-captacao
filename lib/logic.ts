// Lógica de saltos por respuesta. Se usa igual en el navegador y en el servidor.
import type { Field } from "./types";

export type LogicAction = "next" | "end" | `goto:${string}`;

const consentAfter = (fields: Field[], i: number) => {
  for (let k = i + 1; k < fields.length; k++) if (fields[k].type === "consent") return k;
  return -1;
};

/** Acción configurada para la respuesta actual de una pregunta. */
export function actionFor(field: Field, answers: Record<string, unknown>): LogicAction {
  if (field.type !== "select" || !field.logic) return "next";
  const a = field.logic[String(answers[field.id] ?? "")];
  return (a as LogicAction) || "next";
}

/** Índice de la siguiente pregunta según la respuesta. "Terminar" lleva al consentimiento (si lo hay) y después se envía. */
export function nextIndex(fields: Field[], i: number, answers: Record<string, unknown>): number {
  const act = actionFor(fields[i], answers);
  if (act === "end") {
    const c = consentAfter(fields, i);
    return c >= 0 ? c : fields.length;
  }
  if (act.startsWith("goto:")) {
    const k = fields.findIndex((f) => f.id === act.slice(5));
    if (k > i) return k;
  }
  return i + 1;
}

/** Recorre el formulario con las respuestas: qué preguntas vio el lead y si califica (no pasó por ningún "Terminar"). */
export function walk(fields: Field[], answers: Record<string, unknown>) {
  const visited: Field[] = [];
  let qualified = true;
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    visited.push(f);
    if (actionFor(f, answers) === "end") qualified = false;
    i = nextIndex(fields, i, answers);
  }
  return { visited, qualified };
}
