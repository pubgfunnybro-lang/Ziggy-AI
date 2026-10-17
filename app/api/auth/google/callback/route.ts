import { createHash } from "node:crypto";
import { rcall, hit, clientIp, makeCookie } from "../../../../lib/server";

const CLEAR = "zg_state=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0";

function origin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = (req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return proto + "://" + host;
}

function back(req: Request, msg: string | null, cookies: string[]) {
  const h = new Headers({ Location: origin(req) + (msg ? "/?auth=" + msg : "/") });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const saved = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)zg_state=([a-f0-9]+)/)?.[1];
    if (url.searchParams.get("error") || !code || !state || !saved || state !== saved) {
      return back(req, "failed", [CLEAR]);
    }

    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!id || !secret || !process.env.UPSTASH_REDIS_REST_URL || !process.env.AUTH_SECRET) {
      return back(req, "unavailable", [CLEAR]);
    }
    if (await hit("za:g:" + clientIp(req) + ":" + Math.floor(Date.now() / 900000), 950, 20)) {
      return back(req, "slow", [CLEAR]);
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
      return back(req, "failed", [CLEAR]);
    }
    const { access_token } = (await tok.json()) as { access_token?: string };
    if (!access_token) return back(req, "failed", [CLEAR]);

    const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + access_token },
      signal: AbortSignal.timeout(10000),
    });
    if (!ui.ok) {
      console.error("google userinfo", ui.status, await ui.text());
      return back(req, "failed", [CLEAR]);
    }
    const p = (await ui.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
    if (!p.sub || !p.email || p.email_verified !== true) return back(req, "unverified", [CLEAR]);

    const user = "g_" + createHash("sha256").update(p.sub).digest("hex").slice(0, 16);
    const name = String(p.name ?? p.email.split("@")[0]).slice(0, 60);

    let created = Date.now();
    const existing = await rcall([["GET", "zu:" + user]]);
    if (existing && typeof existing[0] === "string") {
      try {
        const o = JSON.parse(existing[0]) as { google?: boolean; created?: number };
        if (!o.google) return back(req, "failed", [CLEAR]);
        created = o.created ?? created;
      } catch {}
    }
    await rcall([["SET", "zu:" + user, JSON.stringify({ google: true, name, email: p.email.toLowerCase(), created })]]);

    return back(req, null, [makeCookie(user), CLEAR]);
  } catch (e) {
    console.error(e);
    return back(req, "failed", [CLEAR]);
  }
}
