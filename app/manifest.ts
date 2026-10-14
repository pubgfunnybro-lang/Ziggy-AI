import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ziggy AI",
    short_name: "Ziggy",
    description: "A fast, friendly AI assistant. Ask anything, in any language.",
    start_url: "/",
    display: "standalone",
    background_color: "#1f1e1d",
    theme_color: "#1f1e1d",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
