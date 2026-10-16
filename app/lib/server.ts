import { createHmac, timingSafeEqual } from "node:crypto";

export async function rcall(cmds: (string | number)[][]): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: unknown }[];
    return j.map((x) => x.result);
  } catch {
    return null;
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function hit(key: string, ttl: number, max: number): Promise<boolean> {
  const r = await rcall([["INCR", key]]);
  if (!r) return false;
  const n = Number(r[0]);
  if (n === 1) await rcall([["EXPIRE", key, ttl]]);
  return n > max;
}

const DAYS30 = 60 * 60 * 24 * 30;

function sign(payload: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "").update(payload).digest("base64url");
}

export function makeCookie(user: string): string {
  const exp = Math.floor(Date.now() / 1000) + DAYS30;
  const payload = user + "." + exp;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return "ziggy_session=" + payload + "." + sign(payload) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + DAYS30 + secure;
}

export function clearCookie(): string {
  return "ziggy_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export function userFrom(req: Request): string | null {
  if (!process.env.AUTH_SECRET) return null;
  const m = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)ziggy_session=([^;]+)/);
  if (!m) return null;
  const parts = m[1].split(".");
  if (parts.length !== 3) return null;
  const [user, exp, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(user + "." + exp));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return /^[a-z0-9_]{3,20}$/.test(user) ? user : null;
}
