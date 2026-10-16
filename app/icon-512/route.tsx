import { ImageResponse } from "next/og";
import { LOGO_FULL } from "../logo";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <img src={LOGO_FULL} width={512} height={512} alt="" />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
