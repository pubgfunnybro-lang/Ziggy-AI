import { randomBytes } from "node:crypto";

function origin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = (req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return proto + "://" + host;
}

export function GET(req: Request) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const base = origin(req);
  if (!id || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_SECRET) {
    return Response.redirect(base + "/?auth=unavailable", 302);
  }
  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: base + "/api/auth/google/callback",
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const secure = base.startsWith("https") ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString(),
      "Set-Cookie": "zg_state=" + state + "; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600" + secure,
    },
  });
}
