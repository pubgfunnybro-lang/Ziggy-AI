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

type MergeChat = { id: string; updated?: number };
type MergeMem = { id: string; text: string; t: number };
type MergeImg = { id: string; prompt: string; t: number };

function parseJson(x: unknown): unknown {
  try {
    return JSON.parse(String(x ?? ""));
  } catch {
    return null;
  }
}

export async function mergeAccount(from: string, to: string) {
  const r = await rcall([
    ["GET", "zc:" + from],
    ["GET", "zc:" + to],
    ["GET", "zm:" + from],
    ["GET", "zm:" + to],
    ["GET", "zgl:" + from],
    ["GET", "zgl:" + to],
  ]);
  if (!r) return;
  const cmds: (string | number)[][] = [];

  const cf = parseJson(r[0]) as { chats?: MergeChat[] } | null;
  const ct = parseJson(r[1]) as { chats?: MergeChat[]; deleted?: string[] } | null;
  if (cf && Array.isArray(cf.chats) && cf.chats.length > 0) {
    const gone = new Set<string>(ct?.deleted ?? []);
    const map = new Map<string, MergeChat>();
    for (const c of [...(ct?.chats ?? []), ...cf.chats]) {
      if (!c || gone.has(c.id)) continue;
      const cur = map.get(c.id);
      if (!cur || (c.updated ?? 0) > (cur.updated ?? 0)) map.set(c.id, c);
    }
    const chats = [...map.values()].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)).slice(0, 50);
    cmds.push(["SET", "zc:" + to, JSON.stringify({ chats, deleted: ct?.deleted ?? [] })]);
  }
  cmds.push(["DEL", "zc:" + from]);

  const mf = parseJson(r[2]) as { items?: MergeMem[] } | null;
  const mt = parseJson(r[3]) as { items?: MergeMem[] } | null;
  if (mf && Array.isArray(mf.items) && mf.items.length > 0) {
    const have = new Set((mt?.items ?? []).map((i) => i.text.toLowerCase()));
    const items = [...(mt?.items ?? [])];
    for (const i of mf.items) if (!have.has(i.text.toLowerCase())) items.push(i);
    cmds.push(["SET", "zm:" + to, JSON.stringify({ items: items.slice(-30) })]);
  }
  cmds.push(["DEL", "zm:" + from]);

  const gf = parseJson(r[4]) as MergeImg[] | null;
  const gt = parseJson(r[5]) as MergeImg[] | null;
  if (Array.isArray(gf) && gf.length > 0) {
    const all = [...(Array.isArray(gt) ? gt : []), ...gf].sort((a, b) => b.t - a.t);
    const keep = all.slice(0, 12);
    for (const g of gf) {
      if (keep.some((k) => k.id === g.id)) cmds.push(["RENAME", "zgi:" + from + ":" + g.id, "zgi:" + to + ":" + g.id]);
      else cmds.push(["DEL", "zgi:" + from + ":" + g.id]);
    }
    for (const d of all.slice(12)) {
      if (!gf.some((g) => g.id === d.id)) cmds.push(["DEL", "zgi:" + to + ":" + d.id]);
    }
    cmds.push(["SET", "zgl:" + to, JSON.stringify(keep)]);
  }
  cmds.push(["DEL", "zgl:" + from]);
  await rcall(cmds);
}
