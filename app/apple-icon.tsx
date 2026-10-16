import { ImageResponse } from "next/og";
import { LOGO_FULL } from "./logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <img src={LOGO_FULL} width={180} height={180} alt="" />
      </div>
    ),
    { ...size }
  );
}
