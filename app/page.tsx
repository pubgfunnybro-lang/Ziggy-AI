"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string; images?: string[]; imgCount?: number; sources?: { title: string; url: string }[]; docs?: { name: string; text: string }[]; docNames?: string[] };
type Chat = { id: string; title: string; messages: Msg[]; updated: number };
type Theme = "dark" | "light";
type Idea = { title: string; sub: string; text: string; icon: string; image?: boolean };
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
const WEB_KEY = "ziggy-web";
const CUSTOM_KEY = "ziggy-custom";

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
  { title: "Analyze an image", sub: "Upload a photo or screenshot", text: "", icon: "image", image: true },
  { title: "Learn Python", sub: "Get a simple study plan", text: "Make me a plan to learn Python", icon: "code" },
  { title: "Explain AI", sub: "In plain words", text: "Explain AI in simple words", icon: "spark" },
  { title: "Write an email", sub: "Short and professional", text: "Help me write a short, professional email to a teacher", icon: "mail" },
];

const CSS = `
.zroot{--bg:#1f1e1d;--text:#ececec;--muted:#9b9a96;--border:rgba(255,255,255,.09);--surface:rgba(255,255,255,.06);--userbg:#2d2c2a;--side:#191817;--input:#262524;--codebg:#161615;--accent:#d97757;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.zroot.light{--bg:#faf9f5;--text:#1f1e1d;--muted:#6b6a66;--border:rgba(0,0,0,.1);--surface:rgba(0,0,0,.05);--userbg:#eeece2;--side:#f3f1ea;--input:#ffffff;--codebg:#f0eee6}
.zroot *{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.zserif{font-family:Georgia,"Times New Roman",serif}
.zmuted{color:var(--muted)}
.zside{background:var(--side);border-right:1px solid var(--border)}
.zinput{background:var(--input);border:1px solid var(--border);box-shadow:0 2px 14px rgba(0,0,0,.14)}
.zinput:focus-within{border-color:var(--muted)}
.zinput textarea{color:var(--text)}
.zinput textarea::placeholder{color:var(--muted)}
.zghost{color:var(--muted);background:transparent}
.zghost:hover{color:var(--text);background:var(--surface)}
.zbtn{border:1px solid var(--border);background:transparent;color:var(--text)}
.zbtn:hover{background:var(--surface)}
.zselect{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:9999px;padding:.35rem .8rem;font-size:.85rem;outline:none;cursor:pointer}
.zselect:hover{background:var(--surface)}
.zselect option{background:#262524;color:#ececec}
.zroot.light .zselect option{background:#ffffff;color:#1f1e1d}
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
.zmd strong{font-weight:600;color:#ffffff;background:var(--accent);padding:.08em .4em;border-radius:.35em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.zroot.light .zmd strong{color:#ffffff}
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
.zcode{position:relative}
.zcopy{position:absolute;top:.6rem;right:.6rem;z-index:1;font-size:12px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:.4rem;padding:.15rem .5rem}
.zcopy:hover{color:var(--text)}
`;

function textOf(node: ReactNode): string {
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
  pre: ({ children }) => <Pre>{children}</Pre>,
  table: ({ children }) => (
    <div className="zscroll">
      <table>{children}</table>
    </div>
  ),
};

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Ziggy">
      <defs>
        <linearGradient id="zlogo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8946f" />
          <stop offset="1" stopColor="#c45f3d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#zlogo)" />
      <path d="M23 12H41A10 10 0 0 1 51 22V32A10 10 0 0 1 41 42H29L19 51V42H23A10 10 0 0 1 13 32V22A10 10 0 0 1 23 12Z" fill="#ffffff" />
      <path d="M20 32L26 22L32 32L38 22L44 32" fill="none" stroke="#c45f3d" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </>
    ),
    code: <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
    spark: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="M18 6L6 18M6 6l12 12" />,
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
    thumbup: <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />,
    thumbdown: <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />,
    up: <path d="M12 19V5M5 12l7-7 7 7" />,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function blank(): Chat {
  return { id: uid(), title: "New chat", messages: [], updated: Date.now() };
}

function groupLabel(ts: number) {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(new Date(ts))) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Previous 7 days";
  return "Older";
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

function sizeOf(c: Chat) {
  return c.messages.reduce((n, m) => n + m.content.length, 0);
}

function sigOf(list: Chat[]) {
  return list
    .filter((c) => c.messages.length > 0)
    .map((c) => c.id + ":" + c.updated + ":" + sizeOf(c))
    .sort()
    .join("|");
}

function strip(c: Chat): Chat {
  return {
    ...c,
    messages: c.messages.map((m) => {
      const { images, docs, ...rest } = m as Msg & { docs?: unknown };
      void docs;
      return { ...rest, imgCount: images ? images.length : rest.imgCount };
    }),
  };
}

function mergeChats(a: Chat[], b: Chat[], dead: string[]): Chat[] {
  const gone = new Set(dead);
  const map = new Map<string, Chat>();
  for (const c of [...a, ...b]) {
    if (gone.has(c.id)) continue;
    const cur = map.get(c.id);
    if (!cur || c.updated > cur.updated || (c.updated === cur.updated && sizeOf(c) > sizeOf(cur))) map.set(c.id, c);
  }
  return [...map.values()];
}

function Feedback({ q, a, persona }: { q: string; a: string; persona: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  function cast(v: "up" | "down") {
    if (vote) return;
    setVote(v);
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: v, q, a, persona }),
    }).catch(() => {});
  }
  return (
    <>
      <button
        onClick={() => cast("up")}
        disabled={vote !== null}
        aria-label="Good answer"
        title="Good answer"
        className="zact"
        style={vote === "up" ? { color: "var(--accent)" } : undefined}
      >
        <Icon name="thumbup" size={14} />
      </button>
      <button
        onClick={() => cast("down")}
        disabled={vote !== null}
        aria-label="Bad answer"
        title="Bad answer"
        className="zact"
        style={vote === "down" ? { color: "var(--accent)" } : undefined}
      >
        <Icon name="thumbdown" size={14} />
      </button>
      {vote && <span className="zmuted self-center text-xs">Thanks for the feedback</span>}
    </>
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
  const [user, setUser] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const chatsRef = useRef<Chat[]>([]);
  const deletedRef = useRef<string[]>([]);
  const lastSigRef = useRef("");
  const [docs, setDocs] = useState<{ name: string; text: string }[]>([]);
  const [custom, setCustom] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [web, setWeb] = useState(false);
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
      setWeb(localStorage.getItem(WEB_KEY) === "1");
      setCustom(localStorage.getItem(CUSTOM_KEY) ?? "");
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
            (m.images && m.images.length > 0) || (m.docs && m.docs.length > 0) ? { role: m.role, content: m.content, imgCount: m.images ? m.images.length : undefined, docNames: m.docs ? m.docs.map((d) => d.name) : undefined } : m
          ),
        }));
      localStorage.setItem(CHATS_KEY, JSON.stringify(keep));
      localStorage.setItem(ACTIVE_KEY, activeId);
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(PERSONA_KEY, persona);
      localStorage.setItem(WEB_KEY, web ? "1" : "0");
      localStorage.setItem(CUSTOM_KEY, custom);
    } catch {}
  }, [chats, activeId, theme, persona, web, custom, ready]);

  chatsRef.current = chats;

  useEffect(() => {
    try {
      const d = localStorage.getItem("ziggy-deleted");
      if (d) deletedRef.current = JSON.parse(d);
    } catch {}
    fetch("/api/auth")
      .then((r) => r.json())
      .then((j: { user?: string | null }) => setUser(j.user ?? null))
      .catch(() => {});
  }, []);

  function rememberDeleted(id: string) {
    deletedRef.current = [...deletedRef.current.filter((x) => x !== id), id].slice(-300);
    try {
      localStorage.setItem("ziggy-deleted", JSON.stringify(deletedRef.current));
    } catch {}
  }

  async function syncChats(force = false): Promise<boolean> {
    const cur = chatsRef.current;
    if (!force && sigOf(cur) === lastSigRef.current) return true;
    try {
      const mine = cur.filter((c) => c.messages.length > 0).map(strip);
      const r = await fetch("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chats: mine, deleted: deletedRef.current }),
      });
      if (r.status === 401) {
        setUser(null);
        return false;
      }
      if (!r.ok) return false;
      const j = (await r.json()) as { chats?: Chat[]; deleted?: string[] };
      deletedRef.current = (j.deleted ?? []).slice(-300);
      try {
        localStorage.setItem("ziggy-deleted", JSON.stringify(deletedRef.current));
      } catch {}
      const merged = mergeChats(chatsRef.current, j.chats ?? [], j.deleted ?? []);
      if (merged.length === 0) merged.push(blank());
      lastSigRef.current = sigOf(merged);
      setChats(merged);
      setActiveId((a) => (merged.some((c) => c.id === a) ? a : [...merged].sort((x, y) => y.updated - x.updated)[0].id));
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (ready && user) syncChats(true);
  }, [user, ready]);

  useEffect(() => {
    if (!ready || !user || loading) return;
    if (sigOf(chats) === lastSigRef.current) return;
    const id = setTimeout(() => {
      syncChats();
    }, 2000);
    return () => clearTimeout(id);
  }, [chats, user, ready, loading]);

  async function submitAuth() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthErr("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: authMode, username: authName, password: authPass }),
      });
      const j = (await r.json()) as { user?: string; error?: string };
      if (!r.ok || !j.user) {
        setAuthErr(j.error || "Something went wrong.");
      } else {
        setUser(j.user);
        setAuthOpen(false);
        setAuthPass("");
        setAuthName("");
      }
    } catch {
      setAuthErr("Network error. Please try again.");
    }
    setAuthBusy(false);
  }

  async function logout() {
    const ok = await syncChats(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {}
    setUser(null);
    lastSigRef.current = "";
    if (ok) {
      deletedRef.current = [];
      try {
        localStorage.removeItem("ziggy-deleted");
      } catch {}
      const b = blank();
      setChats([b]);
      setActiveId(b.id);
    } else {
      setNote("Could not sync before signing out, so your chats were kept on this device.");
    }
    setSidebar(false);
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your account and all chats saved on the server? Chats on this device will stay.")) return;
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
    } catch {}
    setUser(null);
    lastSigRef.current = "";
  }

  const active = chats.find((c) => c.id === activeId);
  const messages = active?.messages ?? [];
  const sorted = [...chats].sort((a, b) => b.updated - a.updated);
  const groups: { label: string; items: Chat[] }[] = [];
  for (const c of sorted) {
    const label = groupLabel(c.updated);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(c);
    else groups.push({ label, items: [c] });
  }

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
    setDocs([]);
    setActiveId(b.id);
    setInput("");
    setImages([]);
    setSidebar(false);
  }

  function removeChat(id: string) {
    rememberDeleted(id);
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

  async function readDoc(f: File): Promise<string> {
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
      const payload = base.map((m) => ({ role: m.role, content: m.content, images: m.images, docs: m.docs }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, persona, web, custom }),
        signal: controller.signal,
      });
      if (res.status === 429) {
        setMsgs(chatId, [...base, { role: "assistant", content: "You have reached the usage limit for now. Please wait a little and try again." }]);
        setLoading(false);
        return;
      }
      if (!res.ok || !res.body) throw new Error("bad response");
      let sources: { title: string; url: string }[] | undefined;
      try {
        const h = res.headers.get("x-ziggy-sources");
        if (h) sources = JSON.parse(decodeURIComponent(h));
      } catch {}
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs(chatId, [...base, { role: "assistant", content: acc, sources }]);
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
    if ((!content && images.length === 0 && docs.length === 0) || loading || !active) return;
    recRef.current?.stop();
    const userMsg: Msg = { role: "user", content };
    if (images.length > 0) userMsg.images = images;
    if (docs.length > 0) userMsg.docs = docs;
    const next: Msg[] = [...active.messages, userMsg];
    const title = active.messages.length === 0 ? content.slice(0, 40) || (docs.length > 0 ? docs[0].name.slice(0, 40) : "Image chat") : undefined;
    setInput("");
    setImages([]);
    setEditing(null);
    setDocs([]);
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

  const canSend = input.trim().length > 0 || images.length > 0 || docs.length > 0;

  return (
    <div className={"zroot relative flex h-dvh overflow-hidden " + theme}>
      <style>{CSS}</style>

      {showSettings && (
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

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAuthOpen(false)}>
          <div
            className="zside w-full max-w-sm rounded-2xl p-5"
            style={{ border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="zserif text-xl">{authMode === "login" ? "Sign in" : "Create account"}</h3>
            <p className="zmuted mt-1 text-sm">Your chats will sync across your devices.</p>
            <input
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              autoCapitalize="none"
              className="zinput mt-4 w-full rounded-xl p-3 text-[15px] outline-none"
            />
            <input
              value={authPass}
              onChange={(e) => setAuthPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAuth()}
              type="password"
              placeholder="Password (8+ characters)"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              className="zinput mt-3 w-full rounded-xl p-3 text-[15px] outline-none"
            />
            {authErr && <p className="mt-2 text-sm text-red-400">{authErr}</p>}
            {authMode === "register" && (
              <p className="zmuted mt-2 text-xs">There is no password reset, so please remember your password.</p>
            )}
            <button
              onClick={submitAuth}
              disabled={authBusy}
              style={{ background: "var(--accent)" }}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {authBusy ? "Please wait" : authMode === "login" ? "Sign in" : "Create account"}
            </button>
            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthErr("");
              }}
              className="zmuted mt-3 w-full text-center text-sm underline"
            >
              {authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      )}

      {sidebar && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebar(false)} />}

      <aside
        className={
          "zside fixed inset-y-0 left-0 z-30 flex w-64 flex-col transition-transform md:static md:translate-x-0 " +
          (sidebar ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <Logo size={28} />
          <span className="zserif text-xl">Ziggy</span>
        </div>
        <div className="px-3 pb-2">
          <button onClick={newChat} className="zitem flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
            <Icon name="plus" size={16} />
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {groups.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="zmuted px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider">{g.label}</div>
              {g.items.map((c) => (
                <div
                  key={c.id}
                  className={"zitem group flex items-center gap-1 rounded-lg px-3 py-2 text-sm " + (c.id === activeId ? "on" : "")}
                >
                  <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 truncate text-left">
                    {c.title}
                  </button>
                  <button
                    onClick={() => removeChat(c.id)}
                    aria-label="Delete chat"
                    className="shrink-0 rounded p-1 opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="px-3 pb-3">
          {user ? (
            <div className="zmuted text-xs">
              <div className="px-1 pb-2">
                Signed in as <span className="font-medium" style={{ color: "var(--text)" }}>{user}</span>. Chats sync to your account.
              </div>
              <div className="flex gap-2">
                <button onClick={logout} className="zbtn rounded-lg px-3 py-1.5 text-xs">
                  Sign out
                </button>
                <button onClick={deleteAccount} className="zghost rounded-lg px-2 py-1.5 text-xs">
                  Delete account
                </button>
              </div>
            </div>
          ) : (
            <div className="zmuted text-xs">
              <button
                onClick={() => {
                  setAuthOpen(true);
                  setAuthErr("");
                }}
                className="zbtn w-full rounded-lg px-3 py-2 text-sm"
              >
                Sign in to sync chats
              </button>
              <p className="px-1 pt-2">Without an account, chats stay in this browser only.</p>
            </div>
          )}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebar(true)} aria-label="Open chats" className="zghost rounded-lg p-2 md:hidden">
              <Icon name="menu" />
            </button>
            <span className="md:hidden">
              <Logo size={26} />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWeb(!web)}
              aria-pressed={web}
              aria-label="Web search"
              title="Search the web for current information"
              className={"flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm " + (web ? "text-white" : "zghost")}
              style={web ? { background: "var(--accent)", borderColor: "var(--accent)" } : { borderColor: "var(--border)" }}
            >
              <Icon name="globe" size={16} />
              <span className="hidden sm:inline">Web</span>
            </button>
            <button onClick={() => setShowSettings(true)} aria-label="Settings" title="Custom instructions" className="zghost rounded-lg p-2">
              <Icon name="sliders" />
            </button>
            <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Personality" className="zselect">
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="zghost rounded-lg p-2"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button onClick={newChat} aria-label="New chat" className="zghost rounded-lg p-2 md:hidden">
              <Icon name="plus" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex max-w-[44rem] flex-col gap-7">
            {ready && messages.length === 0 && (
              <div className="zfade mt-12 text-center sm:mt-20">
                <div className="mx-auto w-fit">
                  <Logo size={56} />
                </div>
                <h2 className="zserif mt-6 text-[2rem] leading-tight sm:text-4xl">How can I help you today?</h2>
                <p className="zmuted mt-2 text-sm">Ask anything, in any language.</p>
                <div className="mt-9 grid gap-3 text-left sm:grid-cols-2">
                  {IDEAS.map((idea) => (
                    <button
                      key={idea.title}
                      onClick={() => (idea.image ? fileRef.current?.click() : send(idea.text))}
                      className="zchip flex items-start gap-3 rounded-xl p-4 transition"
                    >
                      <span className="zmuted mt-0.5">
                        <Icon name={idea.icon} />
                      </span>
                      <span>
                        <span className="block text-[15px] font-medium">{idea.title}</span>
                        <span className="zmuted mt-0.5 block text-sm">{idea.sub}</span>
                      </span>
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
                      {m.docs && m.docs.length > 0 && (
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
                <div key={i} className="zfade flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <Logo size={26} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {m.content ? (
                      <>
                        <div className="zmd">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                        {m.sources && m.sources.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {m.sources.map((s, k) => (
                              <a
                                key={k}
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                title={s.title}
                                className="zchip zmuted max-w-[14rem] truncate rounded-lg px-2.5 py-1 text-xs"
                              >
                                {k + 1}. {hostOf(s.url)}
                              </a>
                            ))}
                          </div>
                        )}
                        {!(loading && i === messages.length - 1) && (
                          <div className="-ml-2 mt-2 flex flex-wrap gap-1">
                            <CopyButton text={m.content} />
                            <SpeakButton text={m.content} />
                            <Feedback key={activeId + ":" + i + ":" + m.content.length} q={messages[i - 1]?.content ?? ""} a={m.content} persona={persona} />
                            {i === messages.length - 1 && (
                              <button onClick={regenerate} className="zact">
                                Retry
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ) : loading && i === messages.length - 1 ? (
                      <div className="flex items-center gap-1.5 py-2.5">
                        <span className="zdot h-1.5 w-1.5 animate-bounce rounded-full" />
                        <span className="zdot h-1.5 w-1.5 animate-bounce rounded-full" style={{ animationDelay: "150ms" }} />
                        <span className="zdot h-1.5 w-1.5 animate-bounce rounded-full" style={{ animationDelay: "300ms" }} />
                        {web && <span className="zmuted ml-2 text-sm">Searching the web</span>}
                      </div>
                    ) : (
                      <span className="zmuted text-sm">No reply.</span>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        <footer className="px-4 pb-3 pt-2">
          <div className="mx-auto max-w-[44rem]">
            {docs.length > 0 && (
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
            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((src, k) => (
                  <div key={k} className="relative">
                    <img src={src} alt="Attachment" className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      onClick={() => setImages((p) => p.filter((_, j) => j !== k))}
                      aria-label="Remove image"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-white"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.txt,.md,.csv,.json,.log,text/plain"
              multiple
              className="hidden"
              onChange={(e) => {
                addAny(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="zinput flex items-end gap-1 rounded-3xl p-2">
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Attach image"
                title="Attach image or document"
                className="zghost flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              >
                <Icon name="image" />
              </button>
              <textarea
                ref={taRef}
                rows={1}
                className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15.5px] outline-none"
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
                    className="zmuted h-10 shrink-0 rounded-full px-1.5 text-[11px] font-semibold"
                  >
                    {VOICES[voiceIdx].label}
                  </button>
                  <button
                    onClick={toggleVoice}
                    aria-label={listening ? "Stop listening" : "Start voice input"}
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                      (listening ? "animate-pulse bg-red-500 text-white" : "zghost")
                    }
                  >
                    <Icon name="mic" />
                  </button>
                </>
              )}
              <button
                onClick={() => (loading ? stop() : send())}
                disabled={!loading && !canSend}
                aria-label={loading ? "Stop" : "Send"}
                style={{ background: "var(--accent)" }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition hover:opacity-90 disabled:opacity-35"
              >
                {loading ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <Icon name="up" />
                )}
              </button>
            </div>
            {note && <p className="mt-2 text-center text-xs text-amber-500">{note}</p>}
            <p className="zmuted mt-2 text-center text-[11px]">Ziggy can make mistakes. Please double-check important information.{" "}
              <a href="/privacy" className="underline">
                Privacy
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
