import Link from "next/link";
import { CATALOGUE_PATH } from "@/lib/links";

export default function Footer() {
  return (
    <footer
      className="reveal relative z-20 flex w-full items-center justify-end px-6 py-8 sm:px-12"
      style={{ animationDelay: "0.5s" }}
    >
      <Link
        href={CATALOGUE_PATH}
        className="group flex items-center gap-4 font-ui text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50 transition-colors duration-500 ease-premium hover:text-gold"
      >
        Catalogue
        <span className="flex h-8 w-8 items-center justify-center border border-white/10 text-white/60 transition-all duration-500 ease-premium group-hover:border-gold/60 group-hover:text-gold">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M1 9L9 1M9 1H2.5M9 1V7.5"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </footer>
  );
}
