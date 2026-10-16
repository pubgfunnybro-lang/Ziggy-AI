import { rcall, hit, clientIp } from "../../lib/server";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (await hit("zr:f:" + ip + ":" + new Date().toISOString().slice(0, 10), 90000, 60)) {
      return Response.json({ ok: false }, { status: 429 });
    }
    const b = await req.json();
    const vote = b.vote === "up" ? "up" : b.vote === "down" ? "down" : null;
    if (!vote) return Response.json({ ok: false }, { status: 400 });
    const entry = JSON.stringify({
      t: new Date().toISOString(),
      v: vote,
      q: String(b.q ?? "").slice(0, 200),
      a: String(b.a ?? "").slice(0, 400),
      p: String(b.persona ?? "").slice(0, 20),
    });
    await rcall([["INCR", "zf:" + vote], ["LPUSH", "zf:log", entry], ["LTRIM", "zf:log", 0, 499]]);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
