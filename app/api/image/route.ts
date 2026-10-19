import { userFrom, hit, clientIp } from "../../lib/server";

export const maxDuration = 60;

const err = (message: string, status = 400) => Response.json({ error: message }, { status });

type Shape = "wide" | "tall" | "square";
const SIZES: Record<Shape, [number, number]> = {
  wide: [1344, 768],
  square: [1024, 1024],
  tall: [768, 1344],
};

const BLOCK = /\b(nude|nudes|naked|nsfw|porn|porno|pornographic|explicit|erotic|hentai|topless|sexual|sex)\b/i;
const NO = "Ziggy can't create that kind of image. Please try a different description.";
const BASE = "@cf/black-forest-labs/";
let skipNew = 0;

async function refine(prompt: string, previous: string): Promise<{ text: string; shape: Shape }> {
  const sys =
    "You are an expert art director writing prompts for a high-end AI image generator. The first line of your reply must be one word: WIDE for landscapes and scenes, TALL for portraits of people or phone wallpapers, or SQUARE for logos, icons, objects, characters and anything else. Then, on the next line, write one rich English prompt of 90 to 140 words. Describe the main subject with concrete details (materials, textures, ornament, wear), the setting in layers (foreground, midground, background), the composition and camera (angle, lens, depth of field), the lighting (direction, quality, colour temperature, rim light, haze), the mood and the colour palette. Keep everything the user asked for and never contradict it. Use vivid, specific nouns instead of vague praise. Unless the user asks for a specific style (anime, cartoon, flat logo, sketch, 3D, pixel art and so on), default to a realistic, cinematic, richly detailed look with dramatic lighting. Do not add text, captions, logos or watermarks. For logos, icons or flat designs, keep the prompt short and describe a simple clean design instead of a scene. If a previous prompt is given, the user wants a changed version of that image: keep its subject and details and apply the requested change. Return only the two parts, nothing else.";
  const user = previous
    ? "Previous image prompt: " + previous.slice(0, 1200) + "\nChange requested: " + prompt
    : "Request: " + prompt;
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
            { role: "user", content: user },
          ],
          ...extra,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) {
        console.error("refine", r.status, await r.text());
        continue;
      }
      const j = await r.json();
      const raw = String(j.choices?.[0]?.message?.content ?? "").trim();
      const m = raw.match(/^\s*(WIDE|TALL|SQUARE)\b[^\n]*\n+([\s\S]+)$/i);
      if (m && m[2].trim().length >= 5) {
        return {
          text: m[2].trim().replace(/^["']|["']$/g, "").slice(0, 1100),
          shape: m[1].toLowerCase() as Shape,
        };
      }
      const plain = raw.replace(/^(WIDE|TALL|SQUARE)\b[:\s-]*/i, "").replace(/^["']|["']$/g, "").slice(0, 1100);
      if (plain.length >= 5) return { text: plain, shape: "square" };
    } catch (e) {
      console.error(e);
    }
  }
  return { text: previous ? (previous.slice(0, 600) + ", " + prompt).slice(0, 1100) : prompt, shape: "square" };
}

async function paint(acct: string, token: string, prompt: string, w: number, h: number) {
  const url = (m: string) => "https://api.cloudflare.com/client/v4/accounts/" + acct + "/ai/run/" + BASE + m;
  const attempts = [...(Date.now() > skipNew ? ["flux-2-klein-9b"] : []), "flux-1-schnell"];
  for (const m of attempts) {
    try {
      let r: Response;
      if (m === "flux-1-schnell") {
        r = await fetch(url(m), {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, steps: 6 }),
          signal: AbortSignal.timeout(25000),
        });
      } else {
        const fd = new FormData();
        fd.append("prompt", prompt);
        fd.append("width", String(w));
        fd.append("height", String(h));
        r = await fetch(url(m), {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: fd,
          signal: AbortSignal.timeout(25000),
        });
      }
      if (!r.ok) {
        console.error("cloudflare image", m, r.status, (await r.text()).slice(0, 300));
        if (m !== "flux-1-schnell" && (r.status === 403 || r.status === 404)) skipNew = Date.now() + 3600000;
        continue;
      }
      let data: ArrayBuffer | null = null;
      if ((r.headers.get("content-type") ?? "").includes("application/json")) {
        const j = (await r.json()) as { result?: { image?: string }; image?: string };
        const b64 = j.result?.image ?? j.image;
        if (b64) data = new Uint8Array(Buffer.from(b64, "base64")).buffer as ArrayBuffer;
      } else {
        data = await r.arrayBuffer();
      }
      if (data && data.byteLength > 1000) {
        console.log("image model", m);
        return { data, model: m };
      }
    } catch (e) {
      console.error(e);
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim().slice(0, 500);
    const previous = String(body.previous ?? "").trim().slice(0, 1200);
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
    if (await hit("zi:all:" + day, 90000, 110)) {
      return err("Ziggy has reached its image limit for today. Please try again tomorrow.", 429);
    }

    const refined = await refine(prompt, previous);
    if (BLOCK.test(refined.text)) return err(NO);
    const [w, h] = SIZES[refined.shape];

    const out = await paint(acct, token, refined.text, w, h);
    if (!out) return err("Could not create the image. Please try again in a moment.", 502);

    return new Response(out.data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "x-ziggy-prompt": encodeURIComponent(refined.text),
        "x-ziggy-model": out.model,
      },
    });
  } catch (e) {
    console.error(e);
    return err("Could not create the image. Please try again.", 500);
  }
}
