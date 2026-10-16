import { rcall, hit, userFrom } from "../../lib/server";

type Item = { id: string; text: string; t: number };

const MAX = 30;
const SENSITIVE = /(password|passcode|\bpin\b|credit card|card number|cvv|ssn|social security|iban|api key|secret key)/i;
const TRIGGER = /\b(remember|my name|call me|i am|i'm|i live|i work|i study|i like|i love|i prefer|i hate|i speak|my favorite|my favourite|my goal)\b/i;

const err = (message: string, status = 400) => Response.json({ error: message }, { status });
const pub = (items: Item[]) => items.map(({ id, text }) => ({ id, text }));

async function load(user: string): Promise<Item[]> {
  const r = await rcall([["GET", "zm:" + user]]);
  try {
    const o = JSON.parse(String(r?.[0] ?? ""));
    return Array.isArray(o.items) ? o.items : [];
  } catch {
    return [];
  }
}

async function save(user: string, items: Item[]) {
  await rcall([["SET", "zm:" + user, JSON.stringify({ items })]]);
}

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function extract(existing: string[], text: string): Promise<string[]> {
  const sys =
    'You extract durable personal facts about the user from their message, to help a chat assistant personalize future replies. Return ONLY JSON like {"facts": ["Name is Nasir", "Studies computer science"]}. Each fact is a short third-person statement of at most 15 words. Only include stable facts the user states about themselves, or things they explicitly ask to be remembered (name, location, job, studies, languages, preferences, goals). Never include sensitive data: passwords, ID or card numbers, health conditions, finances, or private details about other people. If there is nothing worth remembering, return {"facts": []}.';
  const content = "Known facts:\n" + (existing.join("\n") || "(none)") + "\n\nUser message:\n" + text;
  for (const extra of [{ reasoning_effort: "low" }, {}] as Record<string, unknown>[]) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GROQ_API_KEY },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          stream: false,
          messages: [
            { role: "system", content: sys },
            { role: "user", content },
          ],
          ...extra,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) {
        console.error("memory", r.status, await r.text());
        continue;
      }
      const j = await r.json();
      const out = String(j.choices?.[0]?.message?.content ?? "");
      const m = out.match(/\{[\s\S]*\}/);
      if (!m) return [];
      const o = JSON.parse(m[0]);
      if (!Array.isArray(o.facts)) return [];
      return o.facts
        .filter((f: unknown): f is string => typeof f === "string")
        .map((f: string) => f.trim().slice(0, 160))
        .filter((f: string) => f.length >= 3 && !SENSITIVE.test(f))
        .slice(0, 3);
    } catch (e) {
      console.error(e);
    }
  }
  return [];
}

export async function GET(req: Request) {
  const user = userFrom(req);
  if (!user) return err("Please sign in first.", 401);
  return Response.json({ items: pub(await load(user)) });
}

export async function POST(req: Request) {
  try {
    const user = userFrom(req);
    if (!user) return err("Please sign in first.", 401);
    const body = await req.json();
    const action = String(body.action ?? "");
    const items = await load(user);

    if (action === "add") {
      const text = String(body.text ?? "").trim().slice(0, 160);
      if (!text) return err("Write something to remember.");
      if (SENSITIVE.test(text)) return err("For your safety, Ziggy will not save passwords or card details.");
      if (!items.some((i) => i.text.toLowerCase() === text.toLowerCase())) {
        items.push({ id: newId(), text, t: Date.now() });
        while (items.length > MAX) items.shift();
        await save(user, items);
      }
      return Response.json({ items: pub(items) });
    }

    if (action === "delete") {
      const id = String(body.id ?? "");
      const next = items.filter((i) => i.id !== id);
      await save(user, next);
      return Response.json({ items: pub(next) });
    }

    if (action === "clear") {
      await save(user, []);
      return Response.json({ items: [] });
    }

    if (action === "learn") {
      const text = String(body.text ?? "").slice(0, 500);
      if (!TRIGGER.test(text) || SENSITIVE.test(text)) return Response.json({ items: pub(items) });
      if (await hit("zr:mem:" + user + ":" + new Date().toISOString().slice(0, 10), 90000, 100)) {
        return Response.json({ items: pub(items) });
      }
      const facts = await extract(items.map((i) => i.text), text);
      let changed = false;
      for (const f of facts) {
        if (!items.some((i) => i.text.toLowerCase() === f.toLowerCase())) {
          items.push({ id: newId(), text: f, t: Date.now() });
          changed = true;
        }
      }
      if (changed) {
        while (items.length > MAX) items.shift();
        await save(user, items);
      }
      return Response.json({ items: pub(items) });
    }

    return err("Bad request");
  } catch (e) {
    console.error(e);
    return err("Something went wrong.", 500);
  }
}
