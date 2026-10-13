"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "ziggy-chat-v1";
const IDEAS = [
  { icon: "??", text: "Tell me a funny joke" },
  { icon: "??", text: "Make me a plan to learn Python" },
  { icon: "??", text: "Explain AI in simple words" },
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

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-fuchsia-500/20">
            Z
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-lg font-bold leading-tight text-transparent">
              Ziggy AI
            </h1>
            <p className="text-xs text-zinc-400">Your fast and friendly AI buddy</p>
          </div>
        </div>
        <button
          onClick={newChat}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-fuchsia-500 hover:bg-zinc-900"
        >
          + New chat
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {ready && messages.length === 0 && (
            <div className="mt-10 text-center">
              <h2 className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-3xl font-bold text-transparent">
                Hi! I&apos;m Ziggy.
              </h2>
              <p className="mt-2 text-zinc-400">Ask me anything, in any language.</p>
              <div className="mt-6 flex flex-col gap-2">
                {IDEAS.map((idea) => (
                  <button
                    key={idea.text}
                    onClick={() => send(idea.text)}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left text-sm text-zinc-200 hover:border-violet-500 hover:bg-zinc-900/60"
                  >
                    <span className="text-lg">{idea.icon}</span>
                    {idea.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-lg shadow-fuchsia-900/20">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white">
                  Z
                </div>
                <div className="min-w-0 max-w-[88%] rounded-2xl rounded-tl-md border border-violet-500/20 bg-zinc-900 px-4 py-3 text-[15px] text-zinc-100">
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

      <footer className="border-t border-zinc-800 px-4 py-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Ziggy anything..."
          />
          <button
            onClick={() => (loading ? stop() : send())}
            className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 font-semibold text-white"
          >
            {loading ? "Stop" : "Send"}
          </button>
        </div>
      </footer>
    </div>
  );
}
