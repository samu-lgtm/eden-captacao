import { Logo } from "@/components/Logo";
import { Nav } from "./Nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel · Eden" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="side">
        <Logo sub="Captación" />
        <Nav />
        <div className="foot">
          <form method="post" action="/api/logout"><button type="submit">Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="work">{children}</main>
    </div>
  );
}
