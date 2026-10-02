import Image from "next/image";
import Link from "next/link";
import { CATALOGUE_PATH } from "@/lib/links";

export default function Header() {
  return (
    <header
      className="reveal relative z-20 flex w-full items-center justify-between px-6 py-8 sm:px-12"
      style={{ animationDelay: "0.1s" }}
    >
      <Link href="/" aria-label="Cristalux home" className="flex items-center gap-3">
        <Image
          src="/cristalux-mark.png"
          alt=""
          width={30}
          height={34}
          priority
          className="h-8 w-auto"
        />
        <span className="font-display text-sm font-light tracking-[0.35em] text-white">
          CRISTALUX
        </span>
      </Link>

      <Link
        href={CATALOGUE_PATH}
        className="border-b border-white/30 pb-1 font-ui text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition-colors duration-500 ease-premium hover:border-gold hover:text-gold"
      >
        Catalogue
      </Link>
    </header>
  );
}
