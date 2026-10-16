function build(rx: number, scale: number) {
  const o = 32 * (1 - scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8946f"/><stop offset="1" stop-color="#c45f3d"/></linearGradient></defs><rect width="64" height="64" rx="${rx}" fill="url(#g)"/><g transform="translate(${o} ${o}) scale(${scale})"><path d="M23 12H41A10 10 0 0 1 51 22V32A10 10 0 0 1 41 42H29L19 51V42H23A10 10 0 0 1 13 32V22A10 10 0 0 1 23 12Z" fill="#ffffff"/><path d="M20 32L26 22L32 32L38 22L44 32" fill="none" stroke="#c45f3d" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}

function uri(svg: string) {
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

export const LOGO_ROUND = uri(build(16, 1));
export const LOGO_FULL = uri(build(0, 0.82));
