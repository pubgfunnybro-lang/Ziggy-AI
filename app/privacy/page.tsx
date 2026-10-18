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
          <strong>Chats.</strong> Without an account, your chats stay in your browser only. If you create an account, your chats are also saved as text (without images or documents) on Ziggy&apos;s server so they sync across your devices. You can sign in with a username and password (the password is stored only as a salted hash) or with Google, in which case Ziggy receives only your name and email address from Google and never your Google password. Passwords cannot be recovered, and you can delete your account and its saved chats at any time from the sidebar.
        </li>
        <li>
          <strong>What is sent when you chat.</strong> Your message, the earlier messages of that conversation, your custom instructions, and any attached images or document text are sent to Ziggy&apos;s server and forwarded to Groq to generate the reply. Ziggy does not store them afterwards.
        </li>
        <li>
          <strong>Web search.</strong> When you turn on the Web button, your question is sent to Tavily to find sources.
        </li>
        <li>
          <strong>Images.</strong> When you create an image, your description is sent to Groq to improve its wording and to Cloudflare to generate the picture. If you are signed in, your latest 12 generated images are saved to your account so you can see them again, and you can delete them at any time from the Gallery.
        </li>
        <li>
          <strong>Usage limits.</strong> To prevent abuse, your IP address is used in short-lived counters that expire within a day. Hosting provider Vercel may also keep standard server logs.
        </li>
        <li>
          <strong>Analytics.</strong> Anonymous page-view statistics are collected with Vercel Web Analytics.
        </li>
        <li>
          <strong>Memory.</strong> If you are signed in and memory is on, Ziggy may save short facts you tell it about yourself, such as your name or preferences, and use them in future chats. You can view, add, delete or turn off memory at any time from the sidebar. Ziggy is told not to save sensitive data such as passwords.
        </li>
        <li>
          <strong>Feedback.</strong> If you press the thumbs up or thumbs down under an answer, a short snippet of that question and answer is saved so Ziggy can be improved.
        </li>
        <li>
          <strong>Please be careful.</strong> Do not share passwords, ID numbers or other sensitive information. Ziggy can make mistakes, so double-check anything important.
        </li>
      </ul>
    </main>
  );
}
