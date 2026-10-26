"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewFormButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="row">
      {err ? <span className="errbox">{err}</span> : null}
      <button className="btn pri" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await fetch("/api/admin/forms", { method: "POST" });
        const j = await r.json().catch(() => ({}));
        if (r.ok) router.push(`/admin/forms/${j.id}`); else { setErr(j.error || "No se pudo crear."); setBusy(false); }
      }}>+ Nuevo formulario</button>
    </div>
  );
}
