import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy - Ziggy AI" };

export default function Privacy() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 20px", lineHeight: 1.75, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <p>
        <Link href="/" style={{ textDecoration: "underline" }}>
          Back to Ziggy
        </Link>
      </p>
      <h1 style={{ fontSize: 32, margin: "24px 0 8px" }}>Privacy</h1>
      <p>Last updated: October 2026</p>
      <ul style={{ paddingLeft: 20, marginTop: 24, display: "grid", gap: 14 }}>
        <li>
          <strong>Your chats stay in your browser.</strong> Ziggy has no accounts and does not keep a database of conversations. Deleting a chat, or clearing your browser data, removes it.
        </li>
        <li>
          <strong>What is sent when you chat.</strong> Your message, the earlier messages of that conversation, your custom instructions, and any attached images or document text are sent to Ziggy&apos;s server and forwarded to Groq to generate the reply. Ziggy does not store them afterwards.
        </li>
        <li>
          <strong>Web search.</strong> When you turn on the Web button, your question is sent to Tavily to find sources.
        </li>
        <li>
          <strong>Usage limits.</strong> To prevent abuse, your IP address is used in short-lived counters that expire within a day. Hosting provider Vercel may also keep standard server logs.
        </li>
        <li>
          <strong>Analytics.</strong> Anonymous page-view statistics are collected with Vercel Web Analytics.
        </li>
        <li>
          <strong>Please be careful.</strong> Do not share passwords, ID numbers or other sensitive information. Ziggy can make mistakes, so double-check anything important.
        </li>
      </ul>
    </main>
  );
}
