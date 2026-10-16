import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service - Ziggy AI" };

export default function Terms() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 20px", lineHeight: 1.75, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <p>
        <Link href="/" style={{ textDecoration: "underline" }}>
          Back to Ziggy
        </Link>
      </p>
      <h1 style={{ fontSize: 32, margin: "24px 0 8px" }}>Terms of Service</h1>
      <p>Last updated: October 2026</p>
      <ul style={{ paddingLeft: 20, marginTop: 24, display: "grid", gap: 14 }}>
        <li>
          <strong>Acceptance of Terms.</strong> By using Ziggy AI, you agree to these terms. If you do not agree, please do not use the service.
        </li>
        <li>
          <strong>Use of Service.</strong> Ziggy AI provides AI-generated responses for general informational and entertainment purposes. You agree not to use the service for illegal activities or abuse the API limits.
        </li>
        <li>
          <strong>Accuracy & Disclaimers.</strong> AI models can make mistakes or generate false information. Double-check important facts. The service is provided "as is" without warranties of any kind.
        </li>
        <li>
          <strong>Limitation of Liability.</strong> Ziggy AI and its developers are not liable for any damages resulting from your use of the application.
        </li>
      </ul>
    </main>
  );
}
