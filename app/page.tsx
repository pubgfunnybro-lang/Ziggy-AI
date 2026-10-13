"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Msg[]; updated: number };
type Theme = "dark" | "light";
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

const VOICES = [
  { label: "EN", code: "en-US" },
  { label: "UR", code: "ur-PK" },
  { label: "HI", code: "hi-IN" },
  { label: "AR", code: "ar-SA" },
];

const IDEAS = [
  { icon: "??", title: "Tell me a joke", sub: "Make me laugh", text: "Tell me a funny joke" },
  { icon: "??", title: "Learn Python", sub: "Get a study plan", text: "Make me a plan to learn Python" },
  { icon: "??", title: "Explain AI", sub: "In simple words", text: "Explain AI in simple words" },
  { icon: "??", title: "Write something", sub: "Email, bio or caption", text: "Help me write a short, friendly email to a teacher" },
];

const CSS = `
.zroot{--bg:#09090b;--text:#f4f4f5;--muted:#a1a1aa;--faint:#71717a;--border:rgba(255,255,255,.1);--surface:rgba(255,255,255,.05);--surface-hover:rgba(255,255,255,.1);--bubble:rgba(24,24,27,.8);--header:rgba(9,9,11,.6);--side:rgba(9,9,11,.88);--input:rgba(24,24,27,.8);--h1:#f0abfc;--h2:#c4b5fd;--h3:#7dd3fc;--strong:#fcd34d;--em:#f9a8d4;--link:#38bdf8;--code:#6ee7b7;--codebg:#09090b;--quote:rgba(24,24,27,.6);--th:rgba(139,92,246,.35);--rowalt:rgba(24,24,27,.5);background:var(--bg);color:var(--text)}
.zroot.light{--bg:#fafaf9;--text:#18181b;--muted:#52525b;--faint:#71717a;--border:rgba(0,0,0,.1);--surface:rgba(255,255,255,.8);--surface-hover:#ffffff;--bubble:rgba(255,255,255,.92);--header:rgba(255,255,255,.7);--side:rgba(255,255,255,.92);--input:rgba(255,255,255,.95);--h1:#a21caf;--h2:#6d28d9;--h3:#0369a1;--strong:#b45309;--em:#be185d;--link:#0369a1;--code:#047857;--codebg:#f4f4f5;--quote:rgba(244,244,245,.9);--th:rgba(139,92,246,.18);--rowalt:rgba(244,244,245,.8)}
.zroot.light .zglow{opacity:.5}
.zmuted{color:var(--muted)}
.zfaint{color:var(--faint)}
.zcard{background:var(--surface);border:1px solid var(--border)}
.zcard:hover{background:var(--surface-hover);border-color:rgba(217,70,239,.5)}
.zbubble{background:var(--bubble);border:1px solid var(--border)}
.zheader{background:var(--header);border-bottom:1px solid var(--border)}
.zside{background:var(--side);border-right:1px solid var(--border)}
.zinput{background:var(--input);border:1px solid var(--border)}
.zinput:focus-within{border-color:rgba(139,92,246,.6)}
.zinput textarea{color:var(--text)}
.zinput textarea::placeholder{color:var(--faint)}
.zbtn{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.zbtn:hover{background:var(--surface-hover);border-color:rgba(217,70,239,.6)}
.zitem{border:1px solid transparent}
.zitem:hover{background:var(--surface)}
.zitem.on{background:var(--surface-hover);border-color:rgba(217,70,239,.45)}
@keyframes zfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.zfade{animation:zfade .3s ease-out}
.zmd{font-size:15px;line-height:1.65;overflow-wrap:anywhere}
.zmd p{margin:0 0 .6rem}
.zmd p:last-child{margin-bottom:0}
.zmd h1{font-size:1.25rem;font-weight:700;margin:.8rem 0 .5rem;color:var(--h1)}
.zmd h2{font-size:1.1rem;font-weight:700;margin:.8rem 0 .5rem;color:var(--h2)}
.zmd h3{font-size:1rem;font-weight:600;margin:.6rem 0 .4rem;color:var(--h3)}
.zmd strong{font-weight:600;color:var(--strong)}
.zmd em{font-style:italic;color:var(--em)}
.zmd ul{list-style:disc;padding-left:1.25rem;margin:0 0 .6rem}
.zmd ol{list-style:decimal;padding-left:1.25rem;margin:0 0 .6rem}
.zmd li{margin:.2rem 0}
.zmd li::marker{color:#d946ef}
.zmd a{color:var(--link);text-decoration:underline}
.zmd blockquote{border-left:4px solid #d946ef;background:var(--quote);padding:.25rem .75rem;margin:.5rem 0;font-style:italic}
.zmd hr{border:0;border-top:1px solid var(--border);margin:.8rem 0}
.zmd pre{background:var(--codebg);border:1px solid var(--border);border-radius:.75rem;padding:.75rem;overflow-x:auto;margin:.6rem 0}
.zmd code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:var(--code)}
.zmd :not(pre)>code{background:var(--codebg);padding:.1rem .35rem;border-radius:.35rem}
.zmd table{width:100%;border-collapse:collapse;font-size:14px}
.zmd th{background:var(--th);text-align:left;padding:.5rem .75rem;font-weight:600}
.zmd td{border-top:1px solid var(--border);padding:.5rem .75rem}
.zmd tr:nth-child(even) td{background:var(--rowalt)}
.zscroll{overflow-x:auto;border:1px solid var(--border);border-radius:.75rem;margin:.6rem 0}
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
      className="zbtn mt-2 rounded-md px-2 py-0.5 text-xs"
    >
      {done ? "Copied ?" : "Copy"}
    </button>
  );
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [sidebar, setSidebar] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [voiceOk, setVoiceOk] = useState(false);
  const [note, setNote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);

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
      const keep = [...chats].sort((a, b) => b.updated - a.updated).slice(0, 50);
      localStorage.setItem(CHATS_KEY, JSON.stringify(keep));
      localStorage.setItem(ACTIVE_KEY, activeId);
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [chats, activeId, theme, ready]);

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
    setSidebar(false);
  }

  function newChat() {
    if (loading) stop();
    if (active && active.messages.length === 0) {
      setSidebar(false);
      return;
    }
    const b = blank();
    setChats((p) => [b, ...p]);
    setActiveId(b.id);
    setInput("");
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

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setNote("Voice input isn't supported in this browser. Try Chrome or Edge.");
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
      setNote("Voice isn't available here. Allow mic access, or try Chrome or Edge.");
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

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading || !active) return;
    recRef.current?.stop();
    const chatId = active.id;
    const next: Msg[] = [...active.messages, { role: "user", content }];
    const title = active.messages.length === 0 ? content.slice(0, 40) : active.title;
    setChats((p) =>
      p.map((c) =>
        c.id === chatId
          ? { ...c, title, updated: Date.now(), messages: [...next, { role: "assistant", content: "" }] }
          : c
      )
    );
    setInput("");
    setNote("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("bad response");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMsgs(chatId, [...next, { role: "assistant", content: acc }]);
      }
      if (!acc) {
        setMsgs(chatId, [...next, { role: "assistant", content: "Hmm, I didn't get a reply. Please try again." }]);
      }
    } catch {
      if (controller.signal.aborted) {
        setMsgs(chatId, [...next, { role: "assistant", content: acc || "Stopped." }]);
      } else {
        setMsgs(chatId, [...next, { role: "assistant", content: "Sorry, something went wrong on my end. Please try again." }]);
      }
    }
    setLoading(false);
  }

  const canSend = input.trim().length > 0;

  return (
    <div className={"zroot relative flex h-dvh overflow-hidden " + theme}>
      <style>{CSS}</style>

      {sidebar && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebar(false)} />}

      <aside
        className={
          "zside fixed inset-y-0 left-0 z-30 flex w-72 flex-col backdrop-blur-xl transition-transform md:static md:translate-x-0 " +
          (sidebar ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="p-3">
          <button onClick={newChat} className="zbtn w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium">
            + New chat
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {sorted.map((c) => (
            <div key={c.id} className={"zitem flex items-center gap-1 rounded-lg px-3 py-2 text-sm " + (c.id === activeId ? "on" : "")}>
              <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 truncate text-left">
                {c.title}
              </button>
              <button onClick={() => removeChat(c.id)} aria-label="Delete chat" className="zfaint shrink-0 rounded px-1 hover:text-red-400">
                ?
              </button>
            </div>
          ))}
        </div>
        <p className="zfaint px-4 pb-3 text-xs">Chats are saved in this browser only.</p>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="zglow absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="zglow absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
          <div className="zglow absolute left-0 top-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        </div>

        <header className="zheader relative z-10 flex items-center justify-between px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebar(true)} aria-label="Open chats" className="zbtn rounded-lg px-2.5 py-1.5 md:hidden">
              ?
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl font-bold text-white shadow-lg shadow-fuchsia-500/30">
              Z
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-lg font-bold leading-tight text-transparent">
                Ziggy AI
              </h1>
              <p className="zmuted flex items-center gap-1.5 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online and ready to chat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="zbtn rounded-full px-3 py-1.5 text-sm"
            >
              {theme === "dark" ? "?? Light" : "?? Dark"}
            </button>
            <button onClick={newChat} aria-label="New chat" className="zbtn rounded-full px-3 py-1.5 text-sm md:hidden">
              +
            </button>
          </div>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {ready && messages.length === 0 && (
              <div className="zfade mt-6 text-center sm:mt-14">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl font-bold text-white shadow-xl shadow-fuchsia-500/30">
                  Z
                </div>
                <h2 className="mt-5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 bg-clip-text text-4xl font-bold text-transparent">
                  Hi! I&apos;m Ziggy.
                </h2>
                <p className="zmuted mt-2">Ask me anything, in any language.</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {IDEAS.map((idea) => (
                    <button
                      key={idea.text}
                      onClick={() => send(idea.text)}
                      className="zcard rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
                    >
                      <div className="text-2xl">{idea.icon}</div>
                      <div className="mt-2 font-semibold">{idea.title}</div>
                      <div className="zmuted text-sm">{idea.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="zfade flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-lg shadow-fuchsia-900/30">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="zfade flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-md shadow-fuchsia-500/30">
                    Z
                  </div>
                  <div className="zbubble min-w-0 max-w-[90%] rounded-2xl rounded-tl-md px-4 py-3 backdrop-blur">
                    {m.content ? (
                      <>
                        <div className="zmd">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                        {!(loading && i === messages.length - 1) && <CopyButton text={m.content} />}
                      </>
                    ) : loading && i === messages.length - 1 ? (
                      <div className="flex items-center gap-1 py-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-amber-300" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <span className="zfaint text-sm">No reply.</span>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        <footer className="relative z-10 px-4 pb-3 pt-2">
          <div className="mx-auto max-w-3xl">
            <div className="zinput flex items-end gap-2 rounded-3xl p-2 pl-4 shadow-xl shadow-black/20 backdrop-blur-xl">
              <textarea
                ref={taRef}
                rows={1}
                className="max-h-40 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading) send();
                  }
                }}
                placeholder="Ask Ziggy anything..."
              />
              {voiceOk && (
                <>
                  <button
                    onClick={() => setVoiceIdx((voiceIdx + 1) % VOICES.length)}
                    disabled={listening}
                    title="Voice language (click to change)"
                    className="zfaint h-10 shrink-0 rounded-full px-1.5 text-xs font-semibold"
                  >
                    {VOICES[voiceIdx].label}
                  </button>
                  <button
                    onClick={toggleVoice}
                    aria-label={listening ? "Stop listening" : "Start voice input"}
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                      (listening ? "animate-pulse bg-red-500 text-white" : "zbtn")
                    }
                  >
                    ??
                  </button>
                </>
              )}
              <button
                onClick={() => (loading ? stop() : send())}
                disabled={!loading && !canSend}
                aria-label={loading ? "Stop" : "Send"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/40 transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
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
            <p className="zfaint mt-2 text-center text-xs">Ziggy can make mistakes. Double-check important info.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
