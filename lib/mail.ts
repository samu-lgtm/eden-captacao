import "server-only";
import nodemailer from "nodemailer";
import type { Form, ResponseRow } from "./types";

function transport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 465);
  return nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function notifyNewLead(form: Form, r: Pick<ResponseRow, "answers" | "source">, adminUrl: string) {
  const t = transport();
  if (!t) return { ok: false as const, error: "SMTP sin configurar" };
  const to = form.settings.notify_to.split(/[,;\s]+/).filter(Boolean);
  if (!to.length) return { ok: false as const, error: "Sin destinatarios" };
  const nameField = form.fields.find((f) => f.type === "text");
  const name = nameField ? String(r.answers[nameField.id] || "") : "";
  const rows = form.fields
    .map((f) => `<tr><td style="padding:6px 12px 6px 0;color:#5B5148;vertical-align:top">${esc(f.label)}</td><td style="padding:6px 0">${f.type === "consent" ? (r.answers[f.id] ? "Aceptado" : "—") : esc(r.answers[f.id])}</td></tr>`)
    .join("");
  const src = Object.entries(r.source || {}).filter(([, v]) => v).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ");
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: `Nuevo lead · ${name || "sin nombre"} · ${form.name}`,
      html: `<div style="font-family:Arial,sans-serif;color:#2B231F;font-size:14px"><p style="font-size:16px"><b>Nuevo lead en ${esc(form.name)}</b></p><table>${rows}</table>${src ? `<p style="color:#5B5148;font-size:12px">Origen: ${src}</p>` : ""}<p><a href="${esc(adminUrl)}">Ver en el panel</a></p></div>`,
    });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error SMTP" };
  }
}

export async function autoReply(form: Form, r: Pick<ResponseRow, "answers">) {
  const t = transport();
  const emailField = form.fields.find((f) => f.type === "email");
  const to = emailField ? String(r.answers[emailField.id] || "") : "";
  if (!t || !to) return { ok: false as const, error: "Sin SMTP o sin e-mail del lead" };
  const es = form.lang === "es";
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: es ? "Hemos recibido tu solicitud · Eden" : "Recebemos sua solicitação · Eden",
      text: `${form.settings.thanks}\n\nEden · edenperformance.net`,
    });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error SMTP" };
  }
}
