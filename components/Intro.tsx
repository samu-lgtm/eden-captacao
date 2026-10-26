"use client";

export interface IntroData { title: string; bullets: string[]; note: string; button: string }

/** **negrita** → <strong>. El resto se muestra como texto plano. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}

export function Intro({ intro, onStart, preview }: { intro: IntroData; onStart?: () => void; preview?: boolean }) {
  return (
    <div className="intro">
      <h1 className="intro-title" style={preview ? { fontSize: 30 } : undefined}><Rich text={intro.title} /></h1>
      {intro.bullets.length ? <ul className="intro-list">{intro.bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}</ul> : null}
      {intro.note ? <p className="intro-note"><Rich text={intro.note} /></p> : null}
      <div className="pubnav">
        <button className="pbtn" type="button" tabIndex={preview ? -1 : undefined} onClick={onStart} autoFocus={!preview}>{intro.button} →</button>
      </div>
    </div>
  );
}
