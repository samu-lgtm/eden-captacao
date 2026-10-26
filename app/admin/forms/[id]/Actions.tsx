"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResendButton({ id }: { id: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <>
      <button className="btn sm" onClick={async () => {
        setMsg("Enviando…");
        const r = await fetch(`/api/admin/responses/${id}/resend`, { method: "POST" });
        const j = await r.json().catch(() => ({}));
        setMsg(r.ok ? "" : j.error || "Falló otra vez");
        router.refresh();
      }}>Reenviar</button>
      {msg ? <div className="muted" style={{ fontSize: 11, maxWidth: 220 }}>{msg}</div> : null}
    </>
  );
}

export function CopyCsv({ csv }: { csv: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn sm" onClick={async () => {
      try { await navigator.clipboard.writeText(csv); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* */ }
    }}>{done ? "Copiado" : "Copiar como CSV"}</button>
  );
}
