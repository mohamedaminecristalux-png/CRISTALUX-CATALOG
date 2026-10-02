import Link from "next/link";
import type { ReactNode } from "react";

export default function GoldButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const classes = `group relative inline-flex items-center justify-center px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-black transition-all duration-500 ease-premium hover:-translate-y-0.5 ${className}`;
  const style = { background: "linear-gradient(135deg, #c5a059 0%, #b8860b 100%)" };
  const content = (
    <>
      <span className="relative z-10">{children}</span>
      <span
        className="absolute inset-0 opacity-0 transition-opacity duration-500 ease-premium group-hover:opacity-100"
        style={{ boxShadow: "0 0 40px rgba(197, 160, 89, 0.3)" }}
        aria-hidden="true"
      />
    </>
  );

  // external destinations get a plain anchor; next/link is only for in-app routes
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={classes} style={style}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} style={style}>
      {content}
    </Link>
  );
}
