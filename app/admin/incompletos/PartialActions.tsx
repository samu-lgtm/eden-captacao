"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PartialActions({ id, contacted }: { id: string; contacted: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const call = async (method: string, body?: object) => {
    setBusy(true);
    await fetch(`/api/admin/partials/${id}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false); setArmed(false);
    router.refresh();
  };
  return (
    <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
      <button className="btn sm" disabled={busy} onClick={() => call("PATCH", { contacted: !contacted })}>{contacted ? "Desmarcar" : "Marcar contactado"}</button>
      <button className="btn sm danger" disabled={busy} onClick={() => { if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return; } call("DELETE"); }}>{armed ? "Confirmar" : "Eliminar"}</button>
    </div>
  );
}
