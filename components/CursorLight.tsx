"use client";

import { useEffect, useRef } from "react";

/**
 * A real light source for the DOM layer, not the WebGL canvas: a soft radial glow that
 * tracks the cursor and uses mix-blend-mode to actually brighten the header, hero copy,
 * buttons and footer beneath it, rather than sitting behind them as decoration.
 */
export default function CursorLight() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const el = glowRef.current;
    if (!el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let targetX = x;
    let targetY = y;
    let alpha = 0;
    let targetAlpha = 0.45;
    let raf = 0;

    const handleMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (targetAlpha < 0.45) targetAlpha = 0.45;
    };
    const handleDown = () => {
      targetAlpha = 0.8;
    };
    const handleUp = () => {
      targetAlpha = 0.45;
    };
    const handleLeave = () => {
      targetAlpha = 0;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerdown", handleDown);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointerleave", handleLeave);

    const tick = () => {
      x += (targetX - x) * 0.14;
      y += (targetY - y) * 0.14;
      alpha += (targetAlpha - alpha) * 0.08;
      el.style.setProperty("--cursor-x", `${x}px`);
      el.style.setProperty("--cursor-y", `${y}px`);
      el.style.setProperty("--cursor-a", alpha.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointerleave", handleLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30"
      style={{
        background:
          "radial-gradient(320px circle at var(--cursor-x, 50%) var(--cursor-y, 50%), rgba(232, 192, 125, var(--cursor-a, 0)), rgba(232, 192, 125, 0) 65%)",
        mixBlendMode: "screen",
      }}
    />
  );
}
