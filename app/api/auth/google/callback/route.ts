import { createHash } from "node:crypto";
import { rcall, hit, clientIp, makeCookie, userFrom, mergeAccount } from "../../../../lib/server";

const CLEAR = [
  "zg_state=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0",
  "zg_link=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0",
];

function origin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = (req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return proto + "://" + host;
}

function go(req: Request, query: string, cookies: string[]) {
  const h = new Headers({ Location: origin(req) + "/" + query });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

const fail = (req: Request, msg: string) => go(req, "?auth=" + msg, CLEAR);
const linkRes = (req: Request, code: string, extra: string[] = []) => go(req, "?link=" + code, [...CLEAR, ...extra]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookie = req.headers.get("cookie") ?? "";
    const saved = cookie.match(/(?:^|;\s*)zg_state=([a-f0-9]+)/)?.[1];
    const wantLink = /(?:^|;\s*)zg_link=1/.test(cookie);
    if (url.searchParams.get("error") || !code || !state || !saved || state !== saved) {
      return wantLink ? linkRes(req, "fail") : fail(req, "failed");
    }

    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!id || !secret || !process.env.UPSTASH_REDIS_REST_URL || !process.env.AUTH_SECRET) {
      return wantLink ? linkRes(req, "fail") : fail(req, "unavailable");
    }
    if (await hit("za:g:" + clientIp(req) + ":" + Math.floor(Date.now() / 900000), 950, 20)) {
      return wantLink ? linkRes(req, "fail") : fail(req, "slow");
    }

    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: origin(req) + "/api/auth/google/callback",
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tok.ok) {
      console.error("google token", tok.status, await tok.text());
      return wantLink ? linkRes(req, "fail") : fail(req, "failed");
    }
    const { access_token } = (await tok.json()) as { access_token?: string };
    if (!access_token) return wantLink ? linkRes(req, "fail") : fail(req, "failed");

    const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + access_token },
      signal: AbortSignal.timeout(10000),
    });
    if (!ui.ok) {
      console.error("google userinfo", ui.status, await ui.text());
      return wantLink ? linkRes(req, "fail") : fail(req, "failed");
    }
    const p = (await ui.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
    if (!p.sub || !p.email || p.email_verified !== true) return wantLink ? linkRes(req, "fail") : fail(req, "unverified");

    const gid = "g_" + createHash("sha256").update(p.sub).digest("hex").slice(0, 16);
    const email = p.email.toLowerCase();
    const name = String(p.name ?? p.email.split("@")[0]).slice(0, 60);
    const lk = await rcall([["GET", "zl:" + gid]]);
    const linkedTo = typeof lk?.[0] === "string" ? lk[0] : "";

    if (wantLink) {
      const me = userFrom(req);
      if (!me || me.startsWith("g_")) return linkRes(req, "fail");
      if (linkedTo && linkedTo !== me) {
        const ex = await rcall([["EXISTS", "zu:" + linkedTo]]);
        if (ex && Number(ex[0]) === 1) return linkRes(req, "other");
      }
      const pr = await rcall([["GET", "zu:" + me]]);
      let prim: Record<string, unknown> | null = null;
      try {
        prim = JSON.parse(String(pr?.[0] ?? ""));
      } catch {}
      if (!prim || prim.google) return linkRes(req, "fail");
      prim.email = email;
      prim.googleId = gid;
      prim.googleName = name;
      await rcall([["SET", "zu:" + me, JSON.stringify(prim)], ["SET", "zl:" + gid, me]]);
      await mergeAccount(gid, me);
      await rcall([["DEL", "zu:" + gid]]);
      return linkRes(req, "ok", [makeCookie(me)]);
    }

    if (linkedTo) {
      const ex = await rcall([["EXISTS", "zu:" + linkedTo]]);
      if (ex && Number(ex[0]) === 1) return go(req, "", [...CLEAR, makeCookie(linkedTo)]);
      await rcall([["DEL", "zl:" + gid]]);
    }

    let created = Date.now();
    const existing = await rcall([["GET", "zu:" + gid]]);
    if (existing && typeof existing[0] === "string") {
      try {
        const o = JSON.parse(existing[0]) as { google?: boolean; created?: number };
        if (!o.google) return fail(req, "failed");
        created = o.created ?? created;
      } catch {}
    }
    await rcall([["SET", "zu:" + gid, JSON.stringify({ google: true, name, email, created })]]);
    return go(req, "", [...CLEAR, makeCookie(gid)]);
  } catch (e) {
    console.error(e);
    return fail(req, "failed");
  }
}
