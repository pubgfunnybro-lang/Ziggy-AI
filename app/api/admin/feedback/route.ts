import { rcall, userFrom } from "../../../lib/server";

export async function GET(req: Request) {
  const user = userFrom(req);
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const admin = (process.env.ADMIN_USER ?? "").trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  let ok = !!admin && user === admin;
  if (!ok && adminEmail) {
    const r = await rcall([["GET", "zu:" + user]]);
    try {
      const o = JSON.parse(String(r?.[0] ?? ""));
      ok = typeof o.email === "string" && o.email.toLowerCase() === adminEmail;
    } catch {}
  }
  if (!ok) return Response.json({ error: "forbidden" }, { status: 403 });
  const res = await rcall([["GET", "zf:up"], ["GET", "zf:down"], ["LRANGE", "zf:log", 0, 199]]);
  if (!res) return Response.json({ error: "unavailable" }, { status: 503 });
  const log = (Array.isArray(res[2]) ? (res[2] as unknown[]) : [])
    .map((x) => {
      try {
        return JSON.parse(String(x));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return Response.json({ up: Number(res[0] ?? 0), down: Number(res[1] ?? 0), log });
}
