"use client";

import dynamic from "next/dynamic";

const ThreeScene = dynamic(() => import("./ThreeScene"), { ssr: false });

export default function ThreeBackground() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ filter: "brightness(0.6)" }}
      aria-hidden="true"
    >
      <div className="pointer-events-auto h-full w-full">
        <ThreeScene />
      </div>
    </div>
  );
}
