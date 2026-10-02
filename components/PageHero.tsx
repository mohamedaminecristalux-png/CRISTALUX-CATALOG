import type { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

export default function PageHero({
  label,
  title,
  titleAccent,
  description,
  children,
}: {
  label: string;
  title: string;
  titleAccent?: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-charcoal">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, rgba(197,160,89,0.10), transparent 55%)",
        }}
        aria-hidden="true"
      />
      <Header />
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
          <p
            className="reveal font-ui text-[11px] font-semibold uppercase tracking-ultra text-gold"
            style={{ animationDelay: "0.1s" }}
          >
            {label}
          </p>
          <h1
            className="reveal mt-8 font-display text-[2.75rem] font-light leading-[1.02] tracking-tighter text-white sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "0.25s" }}
          >
            {title}
            {titleAccent && (
              <>
                <br />
                <span className="font-serif italic font-light text-gradient-gold">
                  {titleAccent}
                </span>
              </>
            )}
          </h1>
          <p
            className="reveal mt-8 max-w-2xl font-serif text-lg italic font-light text-white/70 sm:text-xl"
            style={{ animationDelay: "0.4s" }}
          >
            {description}
          </p>
          {children && (
            <div className="reveal mt-12 w-full" style={{ animationDelay: "0.55s" }}>
              {children}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
