"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Entry = { t: string; v: "up" | "down"; q: string; a: string; p: string };
type Data = { up: number; down: number; log: Entry[] };

export default function Admin() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "up" | "down">("all");

  useEffect(() => {
    fetch("/api/admin/feedback")
      .then(async (r) => {
        if (r.status === 403) {
          setError("This page is only for the Ziggy admin. Sign in on the main page with the admin account, then come back.");
          return;
        }
        if (!r.ok) {
          setError("Could not load feedback.");
          return;
        }
        setData((await r.json()) as Data);
      })
      .catch(() => setError("Network error."));
  }, []);

  const total = data ? data.up + data.down : 0;
  const pct = data && total > 0 ? Math.round((data.up / total) * 100) : 0;
  const rows = data ? data.log.filter((e) => filter === "all" || e.v === filter) : [];
  const box = { border: "1px solid rgba(128,128,128,.35)", borderRadius: 12, padding: 16 } as const;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px", lineHeight: 1.6, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <p>
        <Link href="/" style={{ textDecoration: "underline" }}>
          Back to Ziggy
        </Link>
      </p>
      <h1 style={{ fontSize: 30, margin: "20px 0 16px" }}>Feedback</h1>
      {error && <p>{error}</p>}
      {!error && !data && <p>Loading...</p>}
      {data && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={box}><div style={{ fontSize: 28, fontWeight: 600 }}>{data.up}</div><div>Thumbs up</div></div>
            <div style={box}><div style={{ fontSize: 28, fontWeight: 600 }}>{data.down}</div><div>Thumbs down</div></div>
            <div style={box}><div style={{ fontSize: 28, fontWeight: 600 }}>{pct}%</div><div>Positive</div></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["all", "down", "up"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(128,128,128,.5)",
                  background: filter === f ? "#d97757" : "transparent",
                  color: filter === f ? "#fff" : "inherit",
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "All" : f === "up" ? "Thumbs up" : "Thumbs down"}
              </button>
            ))}
          </div>
          {rows.length === 0 && <p>No feedback yet.</p>}
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((e, i) => (
              <div key={i} style={box}>
                <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
                  {e.v === "up" ? "Thumbs up" : "Thumbs down"} · {new Date(e.t).toLocaleString()} · {e.p || "unknown"}
                </div>
                <div><strong>Question:</strong> {e.q || "(none)"}</div>
                <div style={{ marginTop: 6 }}><strong>Answer:</strong> {e.a}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
