export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content:
              "You are Ziggy, a friendly, quick-witted AI assistant. Reply in the same language the user writes in.",
          },
          ...messages,
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(data);
      return Response.json(
        { reply: "Sorry, Ziggy ko koi masla aa gaya. Dobara try karo." },
        { status: 500 }
      );
    }

    return Response.json({ reply: data.choices[0].message.content });
  } catch (e) {
    console.error(e);
    return Response.json(
      { reply: "Sorry, Ziggy ko koi masla aa gaya. Dobara try karo." },
      { status: 500 }
    );
  }
}
