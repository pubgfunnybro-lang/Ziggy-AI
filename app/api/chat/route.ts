export const maxDuration = 30;

const SYSTEM = `You are Ziggy, a professional AI assistant.
- Your default language is English. Reply in English unless the user writes in another language or asks you to switch. In that case, reply in the language they use (including Roman Urdu, Urdu script, or any other language).
- Tone: professional, calm, precise and courteous. Use plain language. No slang, no emojis, and no exclamation marks unless the user uses them first.
- Lead with the direct answer, then add brief supporting detail. Be concise. Do not pad with filler and do not restate the question.
- Formatting: short paragraphs. Use lists only when they genuinely help, tables only for real comparisons, and fenced code blocks for code. Avoid headings in short answers and avoid excessive bold.
- Be accurate. If you are unsure or lack information, say so plainly and state your assumptions. Never invent facts, sources or links.
- When the user shares an image, describe only what you can actually see, read any visible text accurately, and say so when something is unclear.
- For medical, legal or financial topics, give general information and suggest consulting a qualified professional where appropriate.`;

const PERSONAS: Record<string, string> = {
  professional: "",
  friendly: "Persona: use a warm, conversational tone while staying clear and accurate. An occasional emoji is fine.",
  tutor: "Persona: act as a patient tutor. Explain step by step with simple examples, then finish with one short question to check understanding.",
  coder: "Persona: act as an expert software engineer. Give clear, correct code in fenced code blocks with brief explanations. Prefer practical solutions.",
  funny: "Persona: be playful and witty. Add light, tasteful humor, but still give correct and useful answers.",
};

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type OutMsg = { role: "user" | "assistant"; content: string | Part[] };
type InMsg = { role?: string; content?: string; images?: unknown; docs?: unknown };
type Attempt = { model: string; extra: Record<string, unknown> };
type Source = { title: string; url: string };
type Check = { key: string; ttl: number; max: number };

const TEXT_ATTEMPTS: Attempt[] = [{ model: "openai/gpt-oss-20b", extra: {} }];
const VISION_ATTEMPTS: Attempt[] = [
  { model: "qwen/qwen3.8-27b", extra: { reasoning_effort: "none" } },
  { model: "qwen/qwen3.8-27b", extra: {} },
  { model: "qwen/qwen3.6-27b", extra: { reasoning_effort: "none" } },
  { model: "qwen/qwen3.6-27b", extra: {} },
];

const MAX_CHARS = 2000;
const MAX_IMAGES = 3;
const MAX_IMG = 1_500_000;
const IMG_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/;
const mem = new Map<string, number>();

async function redis(cmds: (string | number)[][]): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: unknown }[];
    return j.map((x) => x.result);
  } catch {
    return null;
  }
}

async function overLimit(ip: string, kind: "chat" | "search"): Promise<boolean> {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minute = Math.floor(now.getTime() / 60000);
  const checks: Check[] =
    kind === "chat"
      ? [
          { key: `zr:m:${ip}:${minute}`, ttl: 120, max: 10 },
          { key: `zr:d:${ip}:${day}`, ttl: 90000, max: 150 },
        ]
      : [{ key: `zr:s:${ip}:${day}`, ttl: 90000, max: 20 }];
  const res = await redis(checks.map((c) => ["INCR", c.key]));
  if (res && res.length === checks.length) {
    const fresh = checks.filter((_, i) => Number(res[i]) === 1);
    if (fresh.length > 0) await redis(fresh.map((c) => ["EXPIRE", c.key, c.ttl]));
    return checks.some((c, i) => Number(res[i]) > c.max);
  }
  if (mem.size > 5000) mem.clear();
  let over = false;
  for (const c of checks) {
    const n = (mem.get(c.key) ?? 0) + 1;
    mem.set(c.key, n);
    if (n > c.max) over = true;
  }
  return over;
}

async function webSearch(query: string): Promise<{ sources: Source[]; context: string } | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query.trim()) return null;
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ query: query.slice(0, 380), search_depth: "basic", max_results: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error("tavily", r.status, await r.text());
      return null;
    }
    const j = (await r.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    const results = (j.results ?? []).filter((x) => x.url && x.content).slice(0, 5);
    if (results.length === 0) return null;
    const sources = results.map((x) => ({ title: String(x.title ?? x.url).slice(0, 90), url: String(x.url) }));
    const context = results
      .map((x, i) => `[${i + 1}] ${x.title ?? ""}\nURL: ${x.url}\n${String(x.content).slice(0, 700)}`)
      .join("\n\n");
    return { sources, context };
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (await overLimit(ip, "chat")) {
      return new Response("Too many messages. Please wait a while.", { status: 429 });
    }

    const { messages, persona, web, custom } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Bad request", { status: 400 });
    }

    const key = typeof persona === "string" && persona in PERSONAS ? persona : "professional";
    let system = PERSONAS[key] ? SYSTEM + "\n" + PERSONAS[key] : SYSTEM;
    const customNote = typeof custom === "string" ? custom.trim().slice(0, 800) : "";
    if (customNote) {
      system += "\n\nThe user's custom instructions (follow them unless they conflict with safety or accuracy):\n" + customNote;
    }

    const raw: InMsg[] = messages.slice(-20);
    let lastImg = -1;
    raw.forEach((m, i) => {
      if (m.role === "user" && Array.isArray(m.images) && m.images.length > 0) lastImg = i;
    });

    let lastDoc = -1;
    raw.forEach((m, i) => {
      if (m.role === "user" && Array.isArray(m.docs) && m.docs.length > 0) lastDoc = i;
    });

    const clean: OutMsg[] = raw.map((m, i) => {
      let text = String(m.content ?? "").slice(0, MAX_CHARS);
      if (i === lastDoc) {
        let budget = 10000;
        const blocks: string[] = [];
        for (const d of (m.docs as unknown[]).slice(0, 2)) {
          const o = d as { name?: unknown; text?: unknown };
          if (typeof o.text !== "string" || !o.text.trim() || budget <= 0) continue;
          const body = o.text.slice(0, budget);
          budget -= body.length;
          blocks.push("--- Document: " + String(o.name ?? "file").slice(0, 80) + " ---\n" + body);
        }
        if (blocks.length > 0) {
          text = (text || "Please summarize this document.") + "\n\nAttached document content (may be truncated):\n\n" + blocks.join("\n\n");
        }
      }
      if (i === lastImg) {
        const imgs = (m.images as unknown[])
          .filter((u): u is string => typeof u === "string" && IMG_RE.test(u) && u.length < MAX_IMG)
          .slice(0, MAX_IMAGES);
        if (imgs.length > 0) {
          const parts: Part[] = [{ type: "text", text: text || "Please describe this image." }];
          for (const u of imgs) parts.push({ type: "image_url", image_url: { url: u } });
          return { role: "user", content: parts };
        }
      }
      return { role: m.role === "assistant" ? "assistant" : "user", content: text };
    });

    const hasImage = clean.some((m) => Array.isArray(m.content));
    let sources: Source[] = [];

    if (web === true && !hasImage) {
      const users = raw.filter((m) => m.role === "user").map((m) => String(m.content ?? "").trim());
      const last = users[users.length - 1] ?? "";
      const prev = users[users.length - 2] ?? "";
      const query = last.length < 40 && prev ? prev.slice(0, 150) + " " + last : last;
      const found = (await overLimit(ip, "search")) ? null : await webSearch(query);
      if (found) {
        sources = found.sources;
        system +=
          "\n\nWeb search results (retrieved " + new Date().toUTCString().slice(0, 16) + "). Use them for current facts and cite them inline like [1] or [2]. If the results do not answer the question, say so plainly. Do not invent details.\n\n" +
          found.context;
      } else {
        system += "\n\nLive web search is unavailable right now. Answer from your own knowledge and mention that the information may be out of date.";
      }
    }

    const attempts = hasImage ? VISION_ATTEMPTS : TEXT_ATTEMPTS;
    let upstream: Response | null = null;
    for (const a of attempts) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: a.model,
          stream: true,
          messages: [{ role: "system", content: system }, ...clean],
          ...a.extra,
        }),
      });
      if (r.ok && r.body) {
        upstream = r;
        break;
      }
      console.error(a.model, r.status, await r.text());
      if (r.status === 429 || r.status === 401 || r.status === 403) break;
    }

    if (!upstream || !upstream.body) {
      return new Response("Sorry, something went wrong on my end. Please try again.", { status: 500 });
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    let inThink = false;
    let pending = "";

    function strip(chunkText: string, final: boolean): string {
      pending += chunkText;
      let out = "";
      while (true) {
        if (inThink) {
          const end = pending.indexOf("</think>");
          if (end === -1) {
            pending = final ? "" : pending.slice(-8);
            break;
          }
          pending = pending.slice(end + 8);
          inThink = false;
        } else {
          const start = pending.indexOf("<think>");
          if (start === -1) {
            if (final) {
              out += pending;
              pending = "";
            } else if (pending.length > 6) {
              out += pending.slice(0, -6);
              pending = pending.slice(-6);
            }
            break;
          }
          out += pending.slice(0, start);
          pending = pending.slice(start + 7);
          inThink = true;
        }
      }
      return out;
    }

    const stream = upstream.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const d = t.slice(5).trim();
            if (d === "[DONE]") continue;
            try {
              const j = JSON.parse(d);
              const text = j.choices?.[0]?.delta?.content;
              if (text) {
                const o = strip(text, false);
                if (o) controller.enqueue(encoder.encode(o));
              }
            } catch {}
          }
        },
        flush(controller) {
          const o = strip("", true);
          if (o) controller.enqueue(encoder.encode(o));
        },
      })
    );

    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    };
    if (sources.length > 0) headers["x-ziggy-sources"] = encodeURIComponent(JSON.stringify(sources));
    return new Response(stream, { headers });
  } catch (e) {
    console.error(e);
    return new Response("Sorry, something went wrong on my end. Please try again.", { status: 500 });
  }
}
