import { Logo } from "@/components/Logo";

export const metadata = { title: "Entrar · Eden" };

export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="login">
      <form method="post" action="/api/login">
        <Logo sub="Captación" />
        <label className="lbl" style={{ color: "#BDB5A6" }} htmlFor="password">Contraseña del panel
          <input className="inp" id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        {searchParams.error ? <div className="errbox">Contraseña incorrecta.</div> : null}
        <button className="btn pri" type="submit" style={{ justifyContent: "center" }}>Entrar</button>
      </form>
    </div>
  );
}
