import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { rcall, hit, clientIp, makeCookie, clearCookie, userFrom } from "../../lib/server";

const NAME_RE = /^[a-z0-9_]{3,20}$/;
const err = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function GET(req: Request) {
  const user = userFrom(req);
  let name: string | null = null;
  if (user && user.startsWith("g_")) {
    const r = await rcall([["GET", "zu:" + user]]);
    try {
      name = JSON.parse(String(r?.[0] ?? "")).name ?? null;
    } catch {}
  }
  return Response.json({ user, name });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "logout") {
      return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.AUTH_SECRET) {
      return err("Accounts are not available right now.", 503);
    }

    if (action === "delete") {
      const me = userFrom(req);
      if (!me) return err("Please sign in first.", 401);
      await rcall([["DEL", "zu:" + me], ["DEL", "zc:" + me], ["DEL", "zm:" + me]]);
      return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
    }

    const ip = clientIp(req);
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!NAME_RE.test(username)) return err("Username must be 3 to 20 characters: letters, numbers or underscore.");
    if (password.length < 8 || password.length > 100) return err("Password must be 8 to 100 characters.");

    if (action === "register") {
      if (username.startsWith("g_")) return err("Usernames cannot start with g_.");
      if (await hit("za:r:" + ip + ":" + Math.floor(Date.now() / 3600000), 3700, 5)) {
        return err("Too many attempts. Please try again later.", 429);
      }
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      const res = await rcall([["SET", "zu:" + username, JSON.stringify({ salt, hash, created: Date.now() }), "NX"]]);
      if (!res || res[0] !== "OK") return err("That username is taken.", 409);
      return Response.json({ user: username }, { headers: { "Set-Cookie": makeCookie(username) } });
    }

    if (action === "login") {
      const q = Math.floor(Date.now() / 900000);
      if ((await hit("za:l:" + ip + ":" + q, 950, 12)) || (await hit("za:u:" + username + ":" + q, 950, 10))) {
        return err("Too many attempts. Please try again in a few minutes.", 429);
      }
      const res = await rcall([["GET", "zu:" + username]]);
      const rec = res && typeof res[0] === "string" ? (JSON.parse(res[0]) as { salt: string; hash: string }) : null;
      const bad = "Incorrect username or password.";
      if (!rec || !rec.salt) {
        scryptSync(password, "0".repeat(32), 64);
        return err(bad, 401);
      }
      const h = scryptSync(password, rec.salt, 64);
      if (!timingSafeEqual(h, Buffer.from(rec.hash, "hex"))) return err(bad, 401);
      return Response.json({ user: username }, { headers: { "Set-Cookie": makeCookie(username) } });
    }

    return err("Bad request");
  } catch (e) {
    console.error(e);
    return err("Something went wrong. Please try again.", 500);
  }
}
