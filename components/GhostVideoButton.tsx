"use client";

export default function GhostVideoButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-4 px-2 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors duration-500 ease-premium hover:text-white"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition-all duration-500 ease-premium group-hover:border-gold/60 group-hover:scale-105">
        <svg
          width="12"
          height="14"
          viewBox="0 0 12 14"
          fill="none"
          aria-hidden="true"
          className="ml-0.5"
        >
          <path d="M0.5 0.8L11.5 7L0.5 13.2V0.8Z" fill="currentColor" />
        </svg>
      </span>
      <span>Watch Film</span>
    </button>
  );
}
