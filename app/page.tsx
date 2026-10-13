"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "ziggy-chat-v1";
const IDEAS = [
  { icon: "??", title: "Tell me a joke", sub: "Make me laugh", text: "Tell me a funny joke" },
  { icon: "??", title: "Learn Python", sub: "Get a study plan", text: "Make me a plan to learn Python" },
  { icon: "??", title: "Explain AI", sub: "In simple words", text: "Explain AI in simple words" },
  { icon: "??", title: "Write something", sub: "Email, bio or caption", text: "Help me write a short, friendly email to a teacher" },
];

const md: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-xl font-bold text-fuchsia-300">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-lg font-bold text-violet-300">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-base font-semibold text-sky-300">{children}</h3>,
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-amber-300">{children}</strong>,
  em: ({ children }) => <em className="italic text-pink-300">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 marker:text-fuchsia-400">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 marker:text-violet-400">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-sky-400 underline hover:text-sky-300">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-fuchsia-500 bg-zinc-900/60 py-1 pl-3 italic text-zinc-300">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-zinc-700" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-950 p-3">{children}</pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || "") || String(children).includes("\n");
    return isBlock ? (
      <code className="font-mono text-sm text-emerald-300">{children}</code>
    ) : (
      <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-[13px] text-emerald-300">{children}</code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-zinc-700">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gradient-to-r from-violet-600/40 to-fuchsia-600/40">{children}</thead>,
  tr: ({ children }) => <tr className="even:bg-zinc-900/50">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-white">{children}</th>,
  td: ({ children }) => <td className="border-t border-zinc-700 px-3 py-2">{children}</td>,
};

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
      className="mt-2 rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:border-fuchsia-500 hover:text-zinc-200"
    >
      {done ? "Copied ?" : "Copy"}
    </button>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, ready]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    if (loading) return;
    setMessages([]);
    setInput("");
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
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
        setMessages([...next, { role: "assistant", content: acc }]);
      }
      if (!acc) {
        setMessages([...next, { role: "assistant", content: "Hmm, I didn't get a reply. Please try again." }]);
      }
    } catch {
      if (controller.signal.aborted) {
        setMessages([...next, { role: "assistant", content: acc || "Stopped." }]);
      } else {
        setMessages([...next, { role: "assistant", content: "Sorry, something went wrong on my end. Please try again." }]);
      }
    }
    setLoading(false);
  }

  const canSend = input.trim().length > 0;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <style>{`@keyframes zfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.zfade{animation:zfade .3s ease-out}`}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/60 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl font-bold text-white shadow-lg shadow-fuchsia-500/30">
            Z
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-lg font-bold leading-tight text-transparent">
              Ziggy AI
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online and ready to chat
            </p>
          </div>
        </div>
        <button
          onClick={newChat}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-200 transition hover:border-fuchsia-500/60 hover:bg-white/10"
        >
          + New chat
        </button>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6 [scrollbar-width:thin]">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {ready && messages.length === 0 && (
            <div className="zfade mt-6 text-center sm:mt-14">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl font-bold text-white shadow-xl shadow-fuchsia-500/30">
                Z
              </div>
              <h2 className="mt-5 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-4xl font-bold text-transparent">
                Hi! I&apos;m Ziggy.
              </h2>
              <p className="mt-2 text-zinc-400">Ask me anything, in any language.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {IDEAS.map((idea) => (
                  <button
                    key={idea.text}
                    onClick={() => send(idea.text)}
                    className="group rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:-translate-y-0.5 hover:border-fuchsia-500/50 hover:bg-white/10"
                  >
                    <div className="text-2xl">{idea.icon}</div>
                    <div className="mt-2 font-semibold text-zinc-100">{idea.title}</div>
                    <div className="text-sm text-zinc-400">{idea.sub}</div>
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
                <div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-md border border-white/10 bg-zinc-900/80 px-4 py-3 text-[15px] text-zinc-100 backdrop-blur">
                  {m.content ? (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                        {m.content}
                      </ReactMarkdown>
                      {!(loading && i === messages.length - 1) && <CopyButton text={m.content} />}
                    </>
                  ) : (
                    <div className="flex items-center gap-1 py-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-300" style={{ animationDelay: "300ms" }} />
                    </div>
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
          <div className="flex items-end gap-2 rounded-3xl border border-white/10 bg-zinc-900/80 p-2 pl-4 shadow-xl shadow-black/40 backdrop-blur-xl focus-within:border-violet-500/60">
            <textarea
              ref={taRef}
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-zinc-100 placeholder-zinc-500 outline-none"
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
          <p className="mt-2 text-center text-xs text-zinc-500">Ziggy can make mistakes. Double-check important info.</p>
        </div>
      </footer>
    </div>
  );
}
