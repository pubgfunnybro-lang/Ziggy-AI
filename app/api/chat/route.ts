const SYSTEM = `You are Ziggy, a friendly, quick-witted and helpful AI friend.
- Your default language is English. Reply in English unless the user writes in another language or asks you to switch. In that case, reply in the language they use (including Roman Urdu, Urdu script, or any other language).
- Be warm, clear and concise. Add a light touch of humor when it fits.
- Write in clean, simple, professional prose. Keep formatting minimal: short paragraphs, bullet or numbered lists only when they genuinely help, tables only for real comparisons, and fenced code blocks for code. Avoid headings in short answers, avoid excessive bold, and do not use emojis unless the user does.
- If you are not sure about something, say so honestly instead of guessing.`;

const PERSONAS: Record<string, string> = {
  friendly: "",
  tutor:
    "Persona: act as a patient tutor. Explain step by step with simple examples, then finish with one short question to check understanding.",
  coder:
    "Persona: act as an expert software engineer. Give clear, correct code in fenced code blocks with brief explanations. Prefer practical solutions.",
  funny:
    "Persona: be extra playful and witty. Add humor and light jokes, but still give correct, useful answers.",
};

const hits = new Map<string, number[]>();
const LIMIT = 10;
const WINDOW_MS = 60_000;
const MAX_CHARS = 2000;

function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (tooMany(ip)) {
      return new Response("Too many messages. Please wait a minute.", { status: 429 });
    }

    const { messages, persona } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Bad request", { status: 400 });
    }

    const key = typeof persona === "string" && persona in PERSONAS ? persona : "friendly";
    const system = PERSONAS[key] ? SYSTEM + "\n" + PERSONAS[key] : SYSTEM;

    const clean = messages.slice(-20).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, MAX_CHARS),
    }));

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        stream: true,
        messages: [{ role: "system", content: system }, ...clean],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      console.error(await upstream.text());
      return new Response("Sorry, something went wrong on my end. Please try again.", { status: 500 });
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

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
              if (text) controller.enqueue(encoder.encode(text));
            } catch {}
          }
        },
      })
    );

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error(e);
    return new Response("Sorry, something went wrong on my end. Please try again.", { status: 500 });
  }
}
