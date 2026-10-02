import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Cristalux — Luxury Crystal Chandelier Factory & Atelier";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const markPath = path.join(process.cwd(), "public", "cristalux-mark.png");
  const markBase64 = readFileSync(markPath).toString("base64");

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
          background: "#080808",
          backgroundImage:
            "radial-gradient(circle at 50% 30%, rgba(197,160,89,0.18), transparent 60%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${markBase64}`}
          width={88}
          height={100}
          alt=""
          style={{ marginBottom: 40 }}
        />
        <div
          style={{
            fontSize: 96,
            fontWeight: 300,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            display: "flex",
          }}
        >
          Cristalux
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: "#c5a059",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Luxury Crystal Chandelier Factory &amp; Atelier
        </div>
      </div>
    ),
    { ...size }
  );
}
