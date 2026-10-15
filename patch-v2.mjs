import fs from "node:fs";

const jobs = [
  {
    file: "app/api/chat/route.ts",
    edits: [
      [
        String.raw`type InMsg = { role?: string; content?: string; images?: unknown };`,
        String.raw`type InMsg = { role?: string; content?: string; images?: unknown; docs?: unknown };`,
      ],
      [
        String.raw`const { messages, persona, web } = await req.json();`,
        String.raw`const { messages, persona, web, custom } = await req.json();`,
      ],
      [
        String.raw`let system = PERSONAS[key] ? SYSTEM + "\n" + PERSONAS[key] : SYSTEM;`,
        String.raw`let system = PERSONAS[key] ? SYSTEM + "\n" + PERSONAS[key] : SYSTEM;
    const customNote = typeof custom === "string" ? custom.trim().slice(0, 800) : "";
    if (customNote) {
      system += "\n\nThe user's custom instructions (follow them unless they conflict with safety or accuracy):\n" + customNote;
    }`,
      ],
      [
        String.raw`const clean: OutMsg[] = raw.map((m, i) => {`,
        String.raw`let lastDoc = -1;
    raw.forEach((m, i) => {
      if (m.role === "user" && Array.isArray(m.docs) && m.docs.length > 0) lastDoc = i;
    });

    const clean: OutMsg[] = raw.map((m, i) => {`,
      ],
      [
        String.raw`const text = String(m.content ?? "").slice(0, MAX_CHARS);`,
        String.raw`let text = String(m.content ?? "").slice(0, MAX_CHARS);
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
      }`,
      ],
    ],
  },
  {
    file: "app/layout.tsx",
    edits: [
      [
        String.raw`import "./globals.css";`,
        String.raw`import "./globals.css";
import { Analytics } from "@vercel/analytics/next";`,
      ],
      [
        String.raw`<body>{children}</body>`,
        String.raw`<body>
        {children}
        <Analytics />
      </body>`,
      ],
    ],
  },
  {
    file: "app/page.tsx",
    edits: [
      [
        String.raw`imgCount?: number; sources?: { title: string; url: string }[] };`,
        String.raw`imgCount?: number; sources?: { title: string; url: string }[]; docs?: { name: string; text: string }[]; docNames?: string[] };`,
      ],
      [
        String.raw`const WEB_KEY = "ziggy-web";`,
        String.raw`const WEB_KEY = "ziggy-web";
const CUSTOM_KEY = "ziggy-custom";`,
      ],
      [
        String.raw`globe: (`,
        String.raw`sliders: (
      <>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    globe: (`,
      ],
      [
        String.raw`.zscroll{overflow-x:auto;border:1px solid var(--border);border-radius:.75rem;margin:.8rem 0}`,
        String.raw`.zscroll{overflow-x:auto;border:1px solid var(--border);border-radius:.75rem;margin:.8rem 0}
.zcode{position:relative}
.zcopy{position:absolute;top:.6rem;right:.6rem;z-index:1;font-size:12px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:.4rem;padding:.15rem .5rem}
.zcopy:hover{color:var(--text)}`,
      ],
      [
        String.raw`const mdComponents: Components = {`,
        String.raw`function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function Pre({ children }: { children?: ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <div className="zcode">
      <button
        onClick={() => {
          navigator.clipboard
            ?.writeText(textOf(children).replace(/\n$/, ""))
            .then(() => {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            })
            .catch(() => {});
        }}
        className="zcopy"
      >
        {done ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

const mdComponents: Components = {
  pre: ({ children }) => <Pre>{children}</Pre>,`,
      ],
      [
        String.raw`const [note, setNote] = useState("");`,
        String.raw`const [note, setNote] = useState("");
  const [docs, setDocs] = useState<{ name: string; text: string }[]>([]);
  const [custom, setCustom] = useState("");
  const [showSettings, setShowSettings] = useState(false);`,
      ],
      [
        String.raw`setWeb(localStorage.getItem(WEB_KEY) === "1");`,
        String.raw`setWeb(localStorage.getItem(WEB_KEY) === "1");
      setCustom(localStorage.getItem(CUSTOM_KEY) ?? "");`,
      ],
      [
        String.raw`localStorage.setItem(WEB_KEY, web ? "1" : "0");`,
        String.raw`localStorage.setItem(WEB_KEY, web ? "1" : "0");
      localStorage.setItem(CUSTOM_KEY, custom);`,
      ],
      [
        String.raw`}, [chats, activeId, theme, persona, web, ready]);`,
        String.raw`}, [chats, activeId, theme, persona, web, custom, ready]);`,
      ],
      [
        String.raw`body: JSON.stringify({ messages: payload, persona, web }),`,
        String.raw`body: JSON.stringify({ messages: payload, persona, web, custom }),`,
      ],
      [
        String.raw`const payload = base.map((m) => ({ role: m.role, content: m.content, images: m.images }));`,
        String.raw`const payload = base.map((m) => ({ role: m.role, content: m.content, images: m.images, docs: m.docs }));`,
      ],
      [
        String.raw`m.images && m.images.length > 0 ? { role: m.role, content: m.content, imgCount: m.images.length } : m`,
        String.raw`(m.images && m.images.length > 0) || (m.docs && m.docs.length > 0) ? { role: m.role, content: m.content, imgCount: m.images ? m.images.length : undefined, docNames: m.docs ? m.docs.map((d) => d.name) : undefined } : m`,
      ],
      [
        String.raw`function toggleVoice() {`,
        String.raw`async function readDoc(f: File): Promise<string> {
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      if (f.size > 4_000_000) throw new Error("That PDF is larger than 4 MB.");
      const r = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/pdf" }, body: f });
      const j = (await r.json()) as { text?: string; error?: string };
      if (!r.ok) throw new Error(j.error || "Could not read that PDF.");
      return j.text ?? "";
    }
    if (!/\.(txt|md|csv|json|log|py|js|ts|tsx|jsx|html|css)$/i.test(f.name) && !f.type.startsWith("text/")) {
      throw new Error("Unsupported file type. Please use a PDF or a text file.");
    }
    if (f.size > 1_000_000) throw new Error("That file is larger than 1 MB.");
    return await f.text();
  }

  async function addAny(list: FileList | null) {
    if (!list) return;
    const all = Array.from(list);
    const imgs = all.filter((f) => f.type.startsWith("image/"));
    const rest = all.filter((f) => !f.type.startsWith("image/"));
    if (imgs.length > 0) await addFiles(imgs);
    let count = docs.length;
    for (const f of rest) {
      if (count >= 2) {
        setNote("You can attach up to 2 documents per message.");
        break;
      }
      try {
        const text = (await readDoc(f)).trim();
        if (!text) {
          setNote("No readable text found in " + f.name + ". Scanned PDFs are not supported.");
          continue;
        }
        setDocs((p) => [...p, { name: f.name, text: text.slice(0, 10000) }]);
        count += 1;
        setNote(text.length > 10000 ? "Only the first part of long documents is read." : "");
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not read that file.");
      }
    }
  }

  function toggleVoice() {`,
      ],
      [
        String.raw`accept="image/*"`,
        String.raw`accept="image/*,.pdf,.txt,.md,.csv,.json,.log,text/plain"`,
      ],
      [
        String.raw`addFiles(e.target.files);`,
        String.raw`addAny(e.target.files);`,
      ],
      [
        String.raw`title="Attach image"`,
        String.raw`title="Attach image or document"`,
      ],
      [
        String.raw`if ((!content && images.length === 0) || loading || !active) return;`,
        String.raw`if ((!content && images.length === 0 && docs.length === 0) || loading || !active) return;`,
      ],
      [
        String.raw`if (images.length > 0) userMsg.images = images;`,
        String.raw`if (images.length > 0) userMsg.images = images;
    if (docs.length > 0) userMsg.docs = docs;`,
      ],
      [
        String.raw`const title = active.messages.length === 0 ? content.slice(0, 40) || "Image chat" : undefined;`,
        String.raw`const title = active.messages.length === 0 ? content.slice(0, 40) || (docs.length > 0 ? docs[0].name.slice(0, 40) : "Image chat") : undefined;`,
      ],
      [
        String.raw`run(active.id, next, title);`,
        String.raw`setDocs([]);
    run(active.id, next, title);`,
      ],
      [
        String.raw`const canSend = input.trim().length > 0 || images.length > 0;`,
        String.raw`const canSend = input.trim().length > 0 || images.length > 0 || docs.length > 0;`,
      ],
      [
        String.raw`setChats((p) => [b, ...p]);`,
        String.raw`setChats((p) => [b, ...p]);
    setDocs([]);`,
      ],
      [
        String.raw`{!m.images && m.imgCount ? (`,
        String.raw`{m.docs && m.docs.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {m.docs.map((d, k) => (
                            <span key={k} className="zchip zmuted rounded-lg px-2.5 py-1 text-xs">
                              {d.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {!m.docs && m.docNames && m.docNames.length > 0 && (
                        <div className="zmuted mb-1 text-xs">Document attached: {m.docNames.join(", ")} (not kept after reload)</div>
                      )}
                      {!m.images && m.imgCount ? (`,
      ],
      [
        String.raw`{images.length > 0 && (`,
        String.raw`{docs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {docs.map((d, k) => (
                  <span key={k} className="zchip zmuted flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs">
                    {d.name}
                    <button
                      onClick={() => setDocs((p) => p.filter((_, j) => j !== k))}
                      aria-label="Remove document"
                      className="opacity-70 hover:opacity-100"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {images.length > 0 && (`,
      ],
      [
        String.raw`<select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Personality" className="zselect">`,
        String.raw`<button onClick={() => setShowSettings(true)} aria-label="Settings" title="Custom instructions" className="zghost rounded-lg p-2">
              <Icon name="sliders" />
            </button>
            <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Personality" className="zselect">`,
      ],
      [
        String.raw`{sidebar && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebar(false)} />}`,
        String.raw`{showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowSettings(false)}>
          <div
            className="zside w-full max-w-lg rounded-2xl p-5"
            style={{ border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="zserif text-xl">Custom instructions</h3>
            <p className="zmuted mt-1 text-sm">Tell Ziggy how to respond. This applies to every chat.</p>
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, 800))}
              rows={6}
              placeholder="For example: My name is Nasir. I am a student. Keep answers short and use simple English."
              className="zinput mt-4 w-full resize-none rounded-xl p-3 text-[15px] outline-none"
            />
            <div className="zmuted mt-1 text-xs">{custom.length}/800</div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCustom("")} className="zbtn rounded-lg px-3 py-1.5 text-sm">
                Clear
              </button>
              <button onClick={() => setShowSettings(false)} style={{ background: "var(--accent)" }} className="rounded-lg px-4 py-1.5 text-sm text-white">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {sidebar && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebar(false)} />}`,
      ],
      [
        String.raw`Please double-check important information.</p>`,
        String.raw`Please double-check important information.{" "}
              <a href="/privacy" className="underline">
                Privacy
              </a>
            </p>`,
      ],
    ],
  },
];

const staged = [];
for (const job of jobs) {
  let t = fs.readFileSync(job.file, "utf8").replace(/\r\n/g, "\n");
  for (const [a] of job.edits) {
    const n = t.split(a).length - 1;
    if (n !== 1) {
      console.log("STOP. Nothing was changed. " + job.file + ": found " + n + " matches for: " + a.slice(0, 90));
      process.exit(1);
    }
  }
  for (const [a, b] of job.edits) t = t.replace(a, () => b);
  staged.push([job.file, t]);
}
for (const [f, t] of staged) fs.writeFileSync(f, t);
console.log("Updated " + staged.length + " files");
