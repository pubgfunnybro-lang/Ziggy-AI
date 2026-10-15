import { extractText, getDocumentProxy } from "unpdf";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length === 0 || buf.length > 4_000_000) {
      return Response.json({ error: "The PDF must be smaller than 4 MB." }, { status: 413 });
    }
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const out = (Array.isArray(text) ? text.join("\n") : text).trim().slice(0, 30000);
    return Response.json({ text: out });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not read this PDF." }, { status: 400 });
  }
}
