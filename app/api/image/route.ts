import { userFrom, hit, clientIp } from "../../lib/server";

export const maxDuration = 60;

const err = (message: string, status = 400) => Response.json({ error: message }, { status });

const STYLES: Record<string, string> = {
  auto: "",
  photo: "photorealistic photograph, natural lighting, sharp focus, high detail",
  art: "digital painting, detailed illustration, rich colors, concept art",
  anime: "anime style illustration, clean line art, vibrant colors",
  render: "3D render, soft studio lighting, smooth materials, high detail",
  logo: "minimal vector logo design, flat colors, clean shapes, plain white background",
};

const BLOCK = /\b(nude|nudes|naked|nsfw|porn|porno|pornographic|explicit|erotic|hentai|topless|sexual|sex)\b/i;
const NO = "Ziggy can't create that kind of image. Please try a different description.";

async function refine(prompt: string): Promise<string> {
  const sys =
    "You write prompts for an AI image generator. Rewrite the user's request as one vivid English image prompt of at most 60 words. Keep the subject and every detail the user asked for. Do not add text, captions or watermarks to the image. Return only the prompt, with no quotes or explanation.";
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
            { role: "user", content: prompt },
          ],
          ...extra,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) {
        console.error("refine", r.status, await r.text());
        continue;
      }
      const j = await r.json();
      const out = String(j.choices?.[0]?.message?.content ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .slice(0, 600);
      if (out.length >= 5) return out;
    } catch (e) {
      console.error(e);
    }
  }
  return prompt;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim().slice(0, 500);
    const style = typeof body.style === "string" && body.style in STYLES ? body.style : "auto";
    if (prompt.length < 2) return err("Please describe the image you want.");
    if (BLOCK.test(prompt)) return err(NO);

    const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!acct || !token) return err("Image creation is not set up yet.", 503);

    const user = userFrom(req);
    const day = new Date().toISOString().slice(0, 10);
    const who = user ? "u:" + user : "i:" + clientIp(req);
    if (await hit("zi:" + who + ":" + day, 90000, user ? 15 : 6)) {
      return err(
        user
          ? "You have reached today's image limit. Please try again tomorrow."
          : "You have reached today's image limit. Sign in for more, or try again tomorrow.",
        429
      );
    }
    if (await hit("zi:all:" + day, 90000, 140)) {
      return err("Ziggy has reached its image limit for today. Please try again tomorrow.", 429);
    }

    const refined = await refine(prompt);
    if (BLOCK.test(refined)) return err(NO);
    const full = (refined + (STYLES[style] ? ", " + STYLES[style] : "")).slice(0, 1500);

    const r = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" + acct + "/ai/run/@cf/black-forest-labs/flux-1-schnell",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: full, steps: 4 }),
        signal: AbortSignal.timeout(55000),
      }
    );
    if (!r.ok) {
      console.error("cloudflare image", r.status, (await r.text()).slice(0, 500));
      return err(
        r.status === 429
          ? "Image creation is busy right now. Please try again in a moment."
          : "Could not create the image. Please try again.",
        502
      );
    }

    let data: ArrayBuffer;
    if ((r.headers.get("content-type") ?? "").includes("application/json")) {
      const j = (await r.json()) as { result?: { image?: string }; image?: string };
      const b64 = j.result?.image ?? j.image;
      if (!b64) return err("Could not create the image. Please try again.", 502);
      data = new Uint8Array(Buffer.from(b64, "base64")).buffer as ArrayBuffer;
    } else {
      data = await r.arrayBuffer();
    }

    return new Response(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "x-ziggy-prompt": encodeURIComponent(refined.slice(0, 300)),
      },
    });
  } catch (e) {
    console.error(e);
    return err("Could not create the image. Please try again.", 500);
  }
}
