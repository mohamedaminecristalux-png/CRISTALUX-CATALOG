import Link from "next/link";
import type { ReactNode } from "react";

export default function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-4 px-2 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors duration-500 ease-premium hover:text-white"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition-all duration-500 ease-premium group-hover:border-gold/60 group-hover:scale-105">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
          <path
            d="M7 2.2C5.6 1.2 3.6 0.8 1 1v9c2.6-.2 4.6.2 6 1.2M7 2.2c1.4-1 3.4-1.4 6-1.2v9c-2.6-.2-4.6.2-6 1.2M7 2.2v9"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{children}</span>
    </Link>
  );
}
