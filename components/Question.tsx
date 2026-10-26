"use client";
import type { Field } from "@/lib/types";

const PH: Record<string, string> = {
  text: "Escribe aquí", longtext: "Escribe aquí", email: "nombre@empresa.com", phone: "+34 600 000 000", instagram: "@tumarca", url: "https://",
};

export function Question({
  field, index, value, onChange, onPick, preview, privacyUrl, lang,
}: {
  field: Field; index: number; value: string | boolean | undefined;
  onChange?: (v: string) => void; onPick?: (v: string | boolean) => void;
  preview?: boolean; privacyUrl?: string; lang: "es" | "pt";
}) {
  const tab = preview ? -1 : undefined;
  let input: React.ReactNode;
  if (field.type === "select") {
    input = (
      <div className="opts">
        {(field.options || []).map((o, k) => (
          <button type="button" key={o} tabIndex={tab} className={`opt ${value === o ? "on" : ""}`} onClick={() => onPick?.(o)}>
            <kbd>{String.fromCharCode(65 + k)}</kbd>{o}
          </button>
        ))}
      </div>
    );
  } else if (field.type === "consent") {
    input = (
      <>
        <p className="consent">
          {field.text}{" "}
          {privacyUrl ? <a href={privacyUrl} target="_blank" rel="noopener noreferrer">{lang === "es" ? "Política de privacidad" : "Política de privacidade"}</a> : null}
        </p>
        <div className="opts" style={{ marginTop: 14 }}>
          <button type="button" tabIndex={tab} className={`opt ${value === true ? "on" : ""}`} onClick={() => onPick?.(value === true ? false : true)}>
            <kbd>A</kbd>{lang === "es" ? "Acepto" : "Aceito"}
          </button>
        </div>
      </>
    );
  } else if (field.type === "longtext") {
    input = <textarea className="qin" rows={3} tabIndex={tab} readOnly={preview} placeholder={PH.longtext} value={String(value ?? "")} onChange={(e) => onChange?.(e.target.value)} autoFocus={!preview} />;
  } else {
    const type = field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "url" ? "url" : "text";
    const ac = field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "text" ? "name" : "off";
    const ph = field.type === "text" ? (lang === "pt" ? "Escreva aqui" : "Escribe aquí") : field.type === "phone" && lang === "pt" ? "(44) 99999-0000" : field.type === "email" && lang === "pt" ? "nome@empresa.com" : PH[field.type];
    input = <input className="qin" type={type} autoComplete={ac} tabIndex={tab} readOnly={preview} placeholder={ph} value={String(value ?? "")} onChange={(e) => onChange?.(e.target.value)} autoFocus={!preview} />;
  }
  return (
    <div>
      <div className="qn">{index + 1} →</div>
      <div className="q" style={preview ? { fontSize: 28 } : undefined}>
        {field.label}{field.required ? <span className="req"> *</span> : null}
      </div>
      {input}
    </div>
  );
}
