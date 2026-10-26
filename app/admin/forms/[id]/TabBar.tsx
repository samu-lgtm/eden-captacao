"use client";
import Link from "next/link";

export type Tab = "editor" | "config" | "respuestas" | "insights";
const TABS: [Tab, string][] = [["editor", "Editor"], ["respuestas", "Respuestas"], ["insights", "Insights"], ["config", "Ajustes"]];

export function TabBar({ id, tab, onLocal }: { id: string; tab: Tab; onLocal?: (t: Tab) => void }) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map(([k, l]) => {
        const local = onLocal && (k === "editor" || k === "config");
        return (
          <Link key={k} href={`/admin/forms/${id}?tab=${k}`} scroll={false} className={tab === k ? "on" : ""}
            onClick={(e) => {
              if (local) { e.preventDefault(); onLocal!(k); history.replaceState(null, "", `/admin/forms/${id}?tab=${k}`); return; }
            }}>{l}</Link>
        );
      })}
    </div>
  );
}
