import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e8946f, #c45f3d)",
        }}
      >
        <svg width="92" height="101" viewBox="12 10 40 44">
          <path d="M16 14H48V20.5L28.5 43.5H48V50H16V43.5L35.5 20.5H16Z" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
