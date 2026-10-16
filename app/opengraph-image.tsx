import { ImageResponse } from "next/og";
import { LOGO_ROUND } from "./logo";

export const alt = "Ziggy AI - a fast, friendly AI assistant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f1e1d",
          color: "#ececec",
        }}
      >
        <img src={LOGO_ROUND} width={170} height={170} alt="" />
        <div style={{ display: "flex", marginTop: 44, fontSize: 84, fontWeight: 700 }}>Ziggy AI</div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 36, color: "#9b9a96" }}>
          A fast, friendly AI assistant. Ask anything.
        </div>
      </div>
    ),
    { ...size }
  );
}
