export function Logo({ sub }: { sub?: string }) {
  return (
    <span className="brand" aria-label="Eden">
      <svg className="f" aria-hidden="true"><use href="/eden.svg#flower" /></svg>
      <svg className="w" aria-hidden="true"><use href="/eden.svg#wordmark" /></svg>
      {sub ? <small>{sub}</small> : null}
    </span>
  );
}
