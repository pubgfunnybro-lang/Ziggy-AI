"use client";
import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error. Dobara try karo." }]);
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col bg-white p-4 text-black">
      <h1 className="mb-4 text-3xl font-bold">Ziggy AI</h1>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-gray-500">Salam! Main Ziggy hoon. Mujh se kuch bhi poochho.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <span
              className={
                "inline-block whitespace-pre-wrap rounded-2xl px-4 py-2 " +
                (m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-200 text-black")
              }
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && <p className="text-gray-500">Ziggy soch raha hai...</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-xl border p-3 text-black"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ziggy se kuch poochho..."
        />
        <button onClick={send} className="rounded-xl bg-blue-600 px-5 text-white">
          Send
        </button>
      </div>
    </main>
  );
}
