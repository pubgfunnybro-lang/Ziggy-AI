import { rcall, hit, userFrom } from "../../lib/server";

type SMsg = { role: "user" | "assistant"; content: string; sources?: { title: string; url: string }[]; imgCount?: number };
type SChat = { id: string; title: string; updated: number; messages: SMsg[] };

const size = (c: SChat) => c.messages.reduce((n, m) => n + m.content.length, 0);

function clean(c: unknown): SChat | null {
  const o = c as Record<string, unknown> | null;
  if (!o || typeof o.id !== "string" || !Array.isArray(o.messages)) return null;
  const messages: SMsg[] = [];
  for (const m of o.messages.slice(-100)) {
    const x = m as Record<string, unknown> | null;
    if (!x || (x.role !== "user" && x.role !== "assistant") || typeof x.content !== "string") continue;
    const msg: SMsg = { role: x.role, content: x.content.slice(0, 8000) };
    if (Array.isArray(x.sources)) {
      msg.sources = (x.sources as { title?: unknown; url?: unknown }[])
        .slice(0, 5)
        .filter((s) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url))
        .map((s) => ({ title: String(s.title ?? "").slice(0, 90), url: String(s.url).slice(0, 500) }));
    }
    if (typeof x.imgCount === "number") msg.imgCount = Math.min(Math.max(0, Math.floor(x.imgCount)), 3);
    messages.push(msg);
  }
  return { id: o.id.slice(0, 40), title: String(o.title ?? "Chat").slice(0, 80), updated: Number(o.updated) || 0, messages };
}

export async function PUT(req: Request) {
  try {
    const user = userFrom(req);
    if (!user) return Response.json({ error: "auth" }, { status: 401 });
    if (await hit("zr:y:" + user + ":" + Math.floor(Date.now() / 60000), 120, 30)) {
      return Response.json({ error: "slow" }, { status: 429 });
    }
    const body = await req.json();
    const incoming = (Array.isArray(body.chats) ? body.chats.slice(0, 100) : [])
      .map(clean)
      .filter((c: SChat | null): c is SChat => c !== null);
    const dead: string[] = Array.isArray(body.deleted)
      ? body.deleted.filter((x: unknown): x is string => typeof x === "string").map((s: string) => s.slice(0, 40)).slice(-300)
      : [];

    const res = await rcall([["EXISTS", "zu:" + user], ["GET", "zc:" + user]]);
    if (!res || Number(res[0]) !== 1) return Response.json({ error: "auth" }, { status: 401 });

    let stored: { chats?: SChat[]; deleted?: string[] } = {};
    try {
      if (typeof res[1] === "string") stored = JSON.parse(res[1]);
    } catch {}

    const deleted = Array.from(new Set([...(stored.deleted ?? []), ...dead])).slice(-300);
    const gone = new Set(deleted);
    const map = new Map<string, SChat>();
    for (const c of [...(stored.chats ?? []), ...incoming]) {
      if (gone.has(c.id)) continue;
      const cur = map.get(c.id);
      if (!cur || c.updated > cur.updated || (c.updated === cur.updated && size(c) > size(cur))) map.set(c.id, c);
    }
    const chats = [...map.values()]
      .filter((c) => c.messages.length > 0)
      .sort((a, b) => b.updated - a.updated)
      .slice(0, 50);
    while (chats.length > 1 && JSON.stringify(chats).length > 600000) chats.pop();

    await rcall([["SET", "zc:" + user, JSON.stringify({ chats, deleted })]]);
    return Response.json({ chats, deleted });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
