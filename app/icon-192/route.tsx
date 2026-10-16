import { ImageResponse } from "next/og";
import { LOGO_FULL } from "../logo";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <img src={LOGO_FULL} width={192} height={192} alt="" />
      </div>
    ),
    { width: 192, height: 192 }
  );
}
