"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string; images?: string[]; imgCount?: number };
type Chat = { id: string; title: string; messages: Msg[]; updated: number };
type Theme = "dark" | "light";
type Idea = { title: string; sub: string; text: string; image?: boolean };
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechCtor = new () => SpeechRec;

const CHATS_KEY = "ziggy-chats-v2";
const ACTIVE_KEY = "ziggy-active-v2";
const OLD_KEY = "ziggy-chat-v1";
const THEME_KEY = "ziggy-theme";
const PERSONA_KEY = "ziggy-persona-v2";
const MAX_IMAGES = 3;

const PERSONAS = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "tutor", label: "Tutor" },
  { id: "coder", label: "Coder" },
  { id: "funny", label: "Funny" },
];

const VOICES = [
  { label: "EN", code: "en-US" },
  { label: "UR", code: "ur-PK" },
  { label: "HI", code: "hi-IN" },
  { label: "AR", code: "ar-SA" },
];

const IDEAS: Idea[] = [
  { title: "Analyze an image", sub: "Upload a photo or screenshot", text: "", image: true },
  { title: "Learn Python", sub: "Get a simple study plan", text: "Make me a plan to learn Python" },
  { title: "Explain AI", sub: "In plain words", text: "Explain AI in simple words" },
  { title: "Write an email", sub: "Short and polite", text: "Help me write a short, professional email to a teacher" },
];

const CSS = `
.zroot{--bg:#1f1e1d;--text:#ececec;--muted:#9b9a96;--border:rgba(255,255,255,.09);--surface:rgba(255,255,255,.06);--userbg:#2d2c2a;--side:#191817;--input:#2a2927;--codebg:#161615;--accent:#d97757;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.zroot.light{--bg:#faf9f5;--text:#1f1e1d;--muted:#6b6a66;--border:rgba(0,0,0,.1);--surface:rgba(0,0,0,.05);--userbg:#eeece2;--side:#f3f1ea;--input:#ffffff;--codebg:#f0eee6}
.zserif{font-family:Georgia,"Times New Roman",serif}
.zmuted{color:var(--muted)}
.zheader{border-bottom:1px solid var(--border)}
.zside{background:var(--side);border-right:1px solid var(--border)}
.zinput{background:var(--input);border:1px solid var(--border)}
.zinput:focus-within{border-color:var(--muted)}
.zinput textarea{color:var(--text)}
.zinput textarea::placeholder{color:var(--muted)}
.zbtn{border:1px solid var(--border);background:transparent;color:var(--text)}
.zbtn:hover{background:var(--surface)}
.zbtn option{background:#262524;color:#ececec}
.zroot.light .zbtn option{background:#ffffff;color:#1f1e1d}
.zchip{border:1px solid var(--border);background:transparent}
.zchip:hover{background:var(--surface)}
.zuser{background:var(--userbg)}
.zact{color:var(--muted);font-size:12px;padding:.25rem .5rem;border-radius:.4rem}
.zact:hover{background:var(--surface);color:var(--text)}
.zitem{color:var(--muted)}
.zitem:hover{background:var(--surface);color:var(--text)}
.zitem.on{background:var(--surface);color:var(--text)}
.zdot{background:var(--muted)}
@keyframes zfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.zfade{animation:zfade .25s ease-out}
.zmd{font-size:15.5px;line-height:1.7;overflow-wrap:anywhere;color:var(--text)}
.zmd p{margin:0 0 .85rem}
.zmd p:last-child{margin-bottom:0}
.zmd h1,.zmd h2,.zmd h3{font-weight:600;margin:1.1rem 0 .5rem;line-height:1.3}
.zmd h1{font-size:1.3rem}
.zmd h2{font-size:1.15rem}
.zmd h3{font-size:1.05rem}
.zmd strong{font-weight:600}
.zmd em{font-style:italic}
.zmd ul{list-style:disc;padding-left:1.4rem;margin:0 0 .85rem}
.zmd ol{list-style:decimal;padding-left:1.4rem;margin:0 0 .85rem}
.zmd li{margin:.3rem 0}
.zmd li::marker{color:var(--muted)}
.zmd a{color:var(--text);text-decoration:underline;text-underline-offset:3px}
.zmd blockquote{border-left:3px solid var(--border);padding-left:.9rem;margin:.7rem 0;color:var(--muted)}
.zmd hr{border:0;border-top:1px solid var(--border);margin:1rem 0}
.zmd pre{background:var(--codebg);border:1px solid var(--border);border-radius:.75rem;padding:.85rem;overflow-x:auto;margin:.8rem 0}
.zmd code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13.5px;color:var(--text)}
.zmd :not(pre)>code{background:var(--codebg);padding:.1rem .35rem;border-radius:.35rem}
.zmd table{width:100%;border-collapse:collapse;font-size:14.5px}
.zmd th{text-align:left;padding:.55rem .8rem;font-weight:600;border-bottom:1px solid var(--border)}
.zmd td{padding:.55rem .8rem;border-top:1px solid var(--border)}
.zscroll{overflow-x:auto;border:1px solid var(--border);border-radius:.75rem;margin:.8rem 0}
`;

const mdComponents: Components = {
  table: ({ children }) => (
    <div className="zscroll">
      <table>{children}</table>
    </div>
  ),
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function blank(): Chat {
  return { id: uid(), title: "New chat", messages: [], updated: Date.now() };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load"));
    };
    img.src = url;
  });
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          })
          .catch(() => {});
      }}
      className="zact"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function SpeakButton({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  function toggle() {
    const synth = window.speechSynthesis;
    if (on) {
      synth.cancel();
      setOn(false);
      return;
    }
    synth.cancel();
    const clean = text.replace(/[`*_#>|~-]/g, " ").replace(/\s+/g, " ").trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = /[\u0600-\u06FF]/.test(clean) ? "ur-PK" : "en-US";
    u.onend = () => setOn(false);
    u.onerror = () => setOn(false);
    synth.speak(u);
    setOn(true);
  }
  return (
    <button onClick={toggle} className="zact">
      {on ? "Stop reading" : "Read aloud"}
    </button>
  );
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ i: number; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [persona, setPersona] = useState("professional");
  const [sidebar, setSidebar] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [voiceOk, setVoiceOk] = useState(false);
  const [note, setNote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let list: Chat[] = [];
    let act = "";
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      if (raw) {
        list = JSON.parse(raw);
      } else {
        const old = localStorage.getItem(OLD_KEY);
        if (old) {
          const msgs: Msg[] = JSON.parse(old);
          if (Array.isArray(msgs) && msgs.length > 0) {
            const first = msgs.find((m) => m.role === "user");
            list = [{ id: uid(), title: (first?.content ?? "Old chat").slice(0, 40), messages: msgs, updated: Date.now() }];
          }
        }
      }
      act = localStorage.getItem(ACTIVE_KEY) ?? "";
      const th = localStorage.getItem(THEME_KEY);
      if (th === "light" || th === "dark") setTheme(th);
      const pe = localStorage.getItem(PERSONA_KEY);
      if (pe && PERSONAS.some((p) => p.id === pe)) setPersona(pe);
    } catch {}
    if (!Array.isArray(list)) list = [];
    if (list.length === 0) {
      const b = blank();
      list = [b];
      act = b.id;
    }
    if (!list.some((c) => c.id === act)) act = list[0].id;
    setChats(list);
    setActiveId(act);
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setVoiceOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const keep = [...chats]
        .sort((a, b) => b.updated - a.updated)
        .slice(0, 50)
        .map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.images && m.images.length > 0 ? { role: m.role, content: m.content, imgCount: m.images.length } : m
          ),
        }));
      localStorage.setItem(CHATS_KEY, JSON.stringify(keep));
      localStorage.setItem(ACTIVE_KEY, activeId);
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(PERSONA_KEY, persona);
    } catch {}
  }, [chats, activeId, theme, persona, ready]);

  const active = chats.find((c) => c.id === activeId);
  const messages = active?.messages ?? [];
  const sorted = [...chats].sort((a, b) => b.updated - a.updated);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  function setMsgs(id: string, msgs: Msg[]) {
    setChats((p) => p.map((c) => (c.id === id ? { ...c, messages: msgs } : c)));
  }

  function stop() {
    abortRef.current?.abort();
  }

  function openChat(id: string) {
    if (loading) stop();
    setActiveId(id);
    setEditing(null);
    setSidebar(false);
  }

  function newChat() {
    if (loading) stop();
    setEditing(null);
    if (active && active.messages.length === 0) {
      setSidebar(false);
      return;
    }
    const b = blank();
    setChats((p) => [b, ...p]);
    setActiveId(b.id);
    setInput("");
    setImages([]);
    setSidebar(false);
  }

  function removeChat(id: string) {
    if (loading && id === activeId) stop();
    const rest = chats.filter((c) => c.id !== id);
    if (rest.length === 0) {
      const b = blank();
      setChats([b]);
      setActiveId(b.id);
      return;
    }
    setChats(rest);
    if (id === activeId) {
      setActiveId([...rest].sort((a, b) => b.updated - a.updated)[0].id);
    }
  }

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const room = MAX_IMAGES - images.length;
    const files = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(room, 0));
    if (files.length === 0) {
      if (room <= 0) setNote("You can attach up to " + MAX_IMAGES + " images per message.");
      return;
    }
    try {
      const urls = await Promise.all(files.map(fileToDataUrl));
      setImages((p) => [...p, ...urls].slice(0, MAX_IMAGES));
      setNote("");
    } catch {
      setNote("Could not read that image. Please try a JPG or PNG.");
    }
  }

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setNote("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const rec = new Ctor();
    rec.lang = VOICES[voiceIdx].code;
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input.trimEnd() + " " : "";
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(base + text);
    };
    rec.onerror = () => {
      setNote("Voice is not available here. Allow mic access, or try Chrome or Edge.");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setNote("");
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  async function run(chatId: string, base: Msg[], title?: string) {
    setChats((p) =>
      p.map((c) =>
        c.id === chatId
          ? { ...c, ...(title ? { title } : {}), updated: Date.now(), messages: [...base, { role: "assistant", content: "" }] }
          : c
      )
    );
    setNote("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    try {
      const payload = base.map((m) => ({ role: m.role, content: m.content, images: m.images }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, persona }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("bad response");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs(chatId, [...base, { role: "assistant", content: acc }]);
      }
      if (!acc) {
        setMsgs(chatId, [...base, { role: "assistant", content: "I did not get a reply. Please try again." }]);
      }
    } catch {
      if (controller.signal.aborted) {
        setMsgs(chatId, [...base, { role: "assistant", content: acc || "Stopped." }]);
      } else {
        setMsgs(chatId, [...base, { role: "assistant", content: "Sorry, something went wrong on my end. Please try again." }]);
      }
    }
    setLoading(false);
  }

  function send(text?: string) {
    const content = (text ?? input).trim();
    if ((!content && images.length === 0) || loading || !active) return;
    recRef.current?.stop();
    const userMsg: Msg = { role: "user", content };
    if (images.length > 0) userMsg.images = images;
    const next: Msg[] = [...active.messages, userMsg];
    const title = active.messages.length === 0 ? content.slice(0, 40) || "Image chat" : undefined;
    setInput("");
    setImages([]);
    setEditing(null);
    run(active.id, next, title);
  }

  function saveEdit() {
    if (!editing || !active || loading) return;
    const text = editing.text.trim();
    const orig = active.messages[editing.i];
    if (!orig || (!text && !(orig.images && orig.images.length > 0))) return;
    const base: Msg[] = [...active.messages.slice(0, editing.i), { ...orig, content: text }];
    const title = editing.i === 0 ? text.slice(0, 40) || "Image chat" : undefined;
    setEditing(null);
    run(active.id, base, title);
  }

  function regenerate() {
    if (loading || !active) return;
    const lastUser = active.messages.map((m) => m.role).lastIndexOf("user");
    if (lastUser < 0) return;
    run(active.id, active.messages.slice(0, lastUser + 1));
  }

  const canSend = input.trim().length > 0 || images.length > 0;

  return (
    <div className={"zroot relative flex h-dvh overflow-hidden " + theme}>
      <style>{CSS}</style>

      {sidebar && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebar(false)} />}

      <aside
        className={
          "zside fixed inset-y-0 left-0 z-30 flex w-72 flex-col transition-transform md:static md:translate-x-0 " +
          (sidebar ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ background: "var(--accent)" }}>
            Z
          </div>
          <span className="zserif text-lg">Ziggy</span>
        </div>
        <div className="px-3 pb-2 pt-2">
          <button onClick={newChat} className="zbtn w-full rounded-lg px-3 py-2 text-left text-sm">
            + New chat
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {sorted.map((c) => (
            <div key={c.id} className={"zitem flex items-center gap-1 rounded-lg px-3 py-2 text-sm " + (c.id === activeId ? "on" : "")}>
              <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 truncate text-left">
                {c.title}
              </button>
              <button onClick={() => removeChat(c.id)} aria-label="Delete chat" className="shrink-0 rounded px-1 opacity-60 hover:opacity-100">
                ?
              </button>
            </div>
          ))}
        </div>
        <p className="zmuted px-4 pb-3 text-xs">Chats are saved in this browser only.</p>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="zheader flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setSidebar(true)} aria-label="Open chats" className="zbtn rounded-lg px-2.5 py-1 md:hidden">
              ?
            </button>
            <span className="zserif text-lg md:hidden">Ziggy</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              aria-label="Personality"
              className="zbtn rounded-lg px-2 py-1.5 text-sm outline-none"
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="zbtn rounded-lg px-3 py-1.5 text-sm"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button onClick={newChat} aria-label="New chat" className="zbtn rounded-lg px-3 py-1.5 text-sm md:hidden">
              +
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-7">
            {ready && messages.length === 0 && (
              <div className="zfade mt-14 text-center sm:mt-24">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-semibold text-white" style={{ background: "var(--accent)" }}>
                  Z
                </div>
                <h2 className="zserif mt-6 text-4xl">How can I help you today?</h2>
                <p className="zmuted mt-2 text-sm">Ask anything, in any language.</p>
                <div className="mt-9 grid gap-3 text-left sm:grid-cols-2">
                  {IDEAS.map((idea) => (
                    <button
                      key={idea.title}
                      onClick={() => (idea.image ? fileRef.current?.click() : send(idea.text))}
                      className="zchip rounded-xl p-4 transition"
                    >
                      <div className="text-[15px] font-medium">{idea.title}</div>
                      <div className="zmuted mt-0.5 text-sm">{idea.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                editing && editing.i === i ? (
                  <div key={i} className="zfade flex justify-end">
                    <div className="zuser w-full max-w-[85%] rounded-2xl p-3">
                      <textarea
                        autoFocus
                        rows={3}
                        value={editing.text}
                        onChange={(e) => setEditing({ i, text: e.target.value })}
                        className="w-full resize-none bg-transparent text-[15.5px] outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="zbtn rounded-lg px-3 py-1 text-sm">
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          style={{ background: "var(--accent)" }}
                          className="rounded-lg px-3 py-1 text-sm text-white"
                        >
                          Save and send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="zfade flex flex-col items-end gap-1">
                    <div className="zuser max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15.5px] leading-relaxed">
                      {m.images && m.images.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {m.images.map((src, k) => (
                            <img key={k} src={src} alt="Attached" className="max-h-44 rounded-lg" />
                          ))}
                        </div>
                      )}
                      {!m.images && m.imgCount ? (
                        <div className="zmuted mb-1 text-xs">Image attached (not kept after reload)</div>
                      ) : null}
                      {m.content}
                    </div>
                    {!loading && (
                      <button onClick={() => setEditing({ i, text: m.content })} className="zact">
                        Edit
                      </button>
                    )}
                  </div>
                )
              ) : (
                <div key={i} className="zfade">
                  {m.content ? (
                    <>
                      <div className="zmd">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                      {!(loading && i === messages.length - 1) && (
                        <div className="-ml-2 mt-2 flex flex-wrap gap-1">
                          <CopyButton text={m.content} />
                          <SpeakButton text={m.content} />
                          {i === messages.length - 1 && (
                            <button onClick={regenerate} className="zact">
                              Retry
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : loading && i === messages.length - 1 ? (
                    <div className="flex items-center gap-1.5 py-2">
                      <span className="zdot h-1.5 w-1.5 animate-bounce rounded-full" />
                      <span className="zdot h-1.5 w-1.5 animate-bounce rounded-full" style={{ animationDelay: "150ms" }} />
                      <span className="zdot h-1.5 w-1.5 animate-bounce rounded-full" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : (
                    <span className="zmuted text-sm">No reply.</span>
                  )}
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        <footer className="px-4 pb-3 pt-2">
          <div className="mx-auto max-w-3xl">
            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((src, k) => (
                  <div key={k} className="relative">
                    <img src={src} alt="Attachment" className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      onClick={() => setImages((p) => p.filter((_, j) => j !== k))}
                      aria-label="Remove image"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-xs text-white"
                    >
                      ?
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="zinput flex items-end gap-2 rounded-2xl p-2 pl-2 shadow-lg shadow-black/10">
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Attach image"
                title="Attach image"
                className="zbtn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </button>
              <textarea
                ref={taRef}
                rows={1}
                className="max-h-40 flex-1 resize-none bg-transparent py-2.5 text-[15.5px] outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
                  if (files.length > 0) {
                    e.preventDefault();
                    addFiles(files);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading) send();
                  }
                }}
                placeholder="Message Ziggy"
              />
              {voiceOk && (
                <>
                  <button
                    onClick={() => setVoiceIdx((voiceIdx + 1) % VOICES.length)}
                    disabled={listening}
                    title="Voice language (click to change)"
                    className="zmuted h-10 shrink-0 rounded-lg px-1.5 text-xs font-semibold"
                  >
                    {VOICES[voiceIdx].label}
                  </button>
                  <button
                    onClick={toggleVoice}
                    aria-label={listening ? "Stop listening" : "Start voice input"}
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " +
                      (listening ? "animate-pulse bg-red-500 text-white" : "zbtn")
                    }
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={() => (loading ? stop() : send())}
                disabled={!loading && !canSend}
                aria-label={loading ? "Stop" : "Send"}
                style={{ background: "var(--accent)" }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {loading ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
            {note && <p className="mt-2 text-center text-xs text-amber-500">{note}</p>}
            <p className="zmuted mt-2 text-center text-xs">Ziggy can make mistakes. Please double-check important information.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
