"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { confirmLeave } from "@/lib/dirty";

const ITEMS: [string, string][] = [["/admin", "Formularios"], ["/admin/leads", "Leads"], ["/admin/incompletos", "Incompletos"], ["/admin/actividad", "Actividad"]];

export function Nav() {
  const p = usePathname() || "";
  return (
    <nav className="menu">
      {ITEMS.map(([href, label]) => {
        const on = href === "/admin" ? p === "/admin" || p.startsWith("/admin/forms") : p.startsWith(href);
        return <Link key={href} href={href} className={on ? "on" : ""} onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }}>{label}</Link>;
      })}
    </nav>
  );
}
