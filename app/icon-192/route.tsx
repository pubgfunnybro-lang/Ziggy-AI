import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#d97757",
          color: "#ffffff",
          fontSize: 105,
          fontWeight: 700,
        }}
      >
        Z
      </div>
    ),
    { width: 192, height: 192 }
  );
}
