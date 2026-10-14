import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Ziggy AI";
const description = "Ziggy AI is a fast, friendly AI assistant. Ask anything, in any language.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ziggy-ai-pi.vercel.app"),
  title,
  description,
  applicationName: "Ziggy AI",
  openGraph: {
    title,
    description,
    url: "https://ziggy-ai-pi.vercel.app",
    siteName: "Ziggy AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  appleWebApp: {
    capable: true,
    title: "Ziggy",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f1e1d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
