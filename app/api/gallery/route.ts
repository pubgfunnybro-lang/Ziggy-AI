import { rcall, hit, userFrom } from "../../lib/server";

const MAX = 12;
type Item = { id: string; prompt: string; t: number };
const DATA_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const err = (message: string, status = 400) => Response.json({ error: message }, { status });

async function readIndex(user: string): Promise<Item[]> {
  const r = await rcall([["GET", "zgl:" + user]]);
  try {
    const o = JSON.parse(String(r?.[0] ?? ""));
    return Array.isArray(o) ? o : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const user = userFrom(req);
  if (!user) return err("Please sign in first.", 401);
  return Response.json({ items: await readIndex(user) });
}

export async function POST(req: Request) {
  try {
    const user = userFrom(req);
    if (!user) return err("Please sign in first.", 401);
    if (await hit("zgp:" + user + ":" + new Date().toISOString().slice(0, 10), 90000, 60)) {
      return err("Too many saves today.", 429);
    }
    const b = await req.json();
    const data = String(b.data ?? "");
    if (data.length > 700000 || !DATA_RE.test(data)) return err("That image cannot be saved.");
    const prompt = String(b.prompt ?? "").slice(0, 200);
    const id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
    const items = await readIndex(user);
    items.unshift({ id, prompt, t: Date.now() });
    const old = items.splice(MAX);
    const cmds: (string | number)[][] = [
      ["SET", "zgi:" + user + ":" + id, data],
      ["SET", "zgl:" + user, JSON.stringify(items)],
    ];
    for (const o of old) cmds.push(["DEL", "zgi:" + user + ":" + o.id]);
    if (!(await rcall(cmds))) return err("Could not save the image.", 503);
    return Response.json({ id, url: "/api/gallery/image?id=" + id });
  } catch (e) {
    console.error(e);
    return err("Could not save the image.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = userFrom(req);
    if (!user) return err("Please sign in first.", 401);
    const b = (await req.json().catch(() => ({}))) as { id?: unknown; all?: unknown };
    const items = await readIndex(user);
    const cmds: (string | number)[][] = [];
    let next: Item[] = [];
    if (b.all === true) {
      for (const i of items) cmds.push(["DEL", "zgi:" + user + ":" + i.id]);
      cmds.push(["DEL", "zgl:" + user]);
    } else {
      const id = String(b.id ?? "");
      next = items.filter((i) => i.id !== id);
      cmds.push(["DEL", "zgi:" + user + ":" + id], ["SET", "zgl:" + user, JSON.stringify(next)]);
    }
    await rcall(cmds);
    return Response.json({ items: next });
  } catch (e) {
    console.error(e);
    return err("Could not delete.", 500);
  }
}
