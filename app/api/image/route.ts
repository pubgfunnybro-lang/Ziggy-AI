import { userFrom, hit, clientIp } from "../../lib/server";

export const maxDuration = 60;

const err = (message: string, status = 400) => Response.json({ error: message }, { status });

const STYLES: Record<string, string> = {
  auto: "highly detailed, sharp focus, rich realistic textures, professional quality",
  cinematic:
    "cinematic concept art, dramatic moody lighting, volumetric atmosphere, intricate fine details, realistic textures, rich contrast, subtle film grain, ultra detailed",
  photo: "photorealistic photograph, natural lighting, sharp focus, high detail",
  art: "digital painting, detailed illustration, rich colors, concept art",
  anime: "anime style illustration, clean line art, vibrant colors",
  render: "3D render, soft studio lighting, smooth materials, high detail",
  logo: "minimal vector logo design, flat colors, clean shapes, plain white background",
};

const SIZES: Record<string, [number, number]> = {
  wide: [1344, 768],
  square: [1024, 1024],
  tall: [768, 1344],
};

const BLOCK = /\b(nude|nudes|naked|nsfw|porn|porno|pornographic|explicit|erotic|hentai|topless|sexual|sex)\b/i;
const NO = "Ziggy can't create that kind of image. Please try a different description.";
const BASE = "@cf/black-forest-labs/";
let skipNew = 0;

async function refine(prompt: string, style: string): Promise<string> {
  const sys =
    "You are an expert art director writing prompts for a high-end AI image generator. Rewrite the user's request as one rich English prompt of 90 to 140 words. Describe the main subject with concrete details (materials, textures, ornament, wear), the setting in layers (foreground, midground, background), the composition and camera (angle, lens, depth of field), the lighting (direction, quality, colour temperature, rim light, haze), the mood and the colour palette. Keep everything the user asked for and never contradict it. Use vivid, specific nouns instead of vague praise. Do not add text, captions, logos or watermarks. For logos, icons or flat designs, keep the prompt short and describe a simple clean design instead of a scene. Return only the prompt.";
  const user = "Request: " + prompt + (style !== "auto" ? "\nStyle: " + style : "");
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
      const out = String(j.choices?.[0]?.message?.content ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .slice(0, 1100);
      if (out.length >= 5) return out;
    } catch (e) {
      console.error(e);
    }
  }
  return prompt;
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
    const style = typeof body.style === "string" && body.style in STYLES ? body.style : "auto";
    const size = typeof body.size === "string" && body.size in SIZES ? body.size : "wide";
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

    const refined = await refine(prompt, style);
    if (BLOCK.test(refined)) return err(NO);
    const full = (refined + ", " + STYLES[style]).slice(0, 1600);
    const [w, h] = SIZES[size];

    const out = await paint(acct, token, full, w, h);
    if (!out) return err("Could not create the image. Please try again in a moment.", 502);

    return new Response(out.data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "x-ziggy-prompt": encodeURIComponent(refined.slice(0, 300)),
        "x-ziggy-model": out.model,
      },
    });
  } catch (e) {
    console.error(e);
    return err("Could not create the image. Please try again.", 500);
  }
}
