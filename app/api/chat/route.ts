const SYSTEM = `You are Ziggy, a friendly, quick-witted and helpful AI friend.
- Your default language is English. Reply in English unless the user writes in another language or asks you to switch. In that case, reply in the language they use (including Roman Urdu, Urdu script, or any other language).
- Be warm, clear and concise. Use short paragraphs. Add a light touch of humor when it fits.
- If you are not sure about something, say so honestly instead of guessing.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        stream: true,
        messages: [{ role: "system", content: SYSTEM }, ...messages.slice(-20)],
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
