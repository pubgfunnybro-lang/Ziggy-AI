"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "ziggy-chat-v1";
const IDEAS = [
  "Tell me a funny joke",
  "Make me a plan to learn Python",
  "Explain AI in simple words",
];

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) throw new Error("bad response");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
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
      setMessages([...next, { role: "assistant", content: "Sorry, something went wrong on my end. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white">
            Z
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Ziggy AI</h1>
            <p className="text-xs text-zinc-400">Your fast and friendly AI buddy</p>
          </div>
        </div>
        <button
          onClick={newChat}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          + New chat
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {ready && messages.length === 0 && (
            <div className="mt-10 text-center">
              <h2 className="text-2xl font-bold">Hi! I'm Ziggy.</h2>
              <p className="mt-2 text-zinc-400">Ask me anything, in any language.</p>
              <div className="mt-6 flex flex-col gap-2">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    onClick={() => send(idea)}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left text-sm text-zinc-200 hover:border-violet-500"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed " +
                  (m.role === "user"
                    ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"
                    : "bg-zinc-800 text-zinc-100")
                }
              >
                {m.content || (loading && i === messages.length - 1 ? "Ziggy is thinking..." : "")}
              </div>
            </div>
          ))}
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
            onClick={() => send()}
            disabled={loading}
            className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
