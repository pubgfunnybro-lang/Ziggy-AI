import { rcall, userFrom } from "../../../lib/server";

const PREFIX = "data:image/jpeg;base64,";

export async function GET(req: Request) {
  const user = userFrom(req);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!user || !/^[a-z0-9]{6,30}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await rcall([["GET", "zgi:" + user + ":" + id]]);
  const data = typeof r?.[0] === "string" ? r[0] : "";
  if (!data.startsWith(PREFIX)) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(Buffer.from(data.slice(PREFIX.length), "base64"));
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
