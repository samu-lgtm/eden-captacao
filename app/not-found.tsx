import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="pub">
      <div className="pubtop"><Logo /></div>
      <div className="pubwrap"><div className="qn">404</div><div className="q">Este formulario no está disponible.</div>
        <p className="hint"><a href="https://edenperformance.net" style={{ color: "inherit" }}>Ir a edenperformance.net</a></p></div>
    </div>
  );
}
