import GoldButton from "./GoldButton";
import GhostLink from "./GhostLink";
import { CATALOGUE_PATH, COLLECTION_URL } from "@/lib/links";

export default function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <p
          className="reveal text-legible font-ui text-[11px] font-semibold uppercase tracking-ultra text-gold"
          style={{ animationDelay: "0.2s" }}
        >
          Superior Crystal Chandeliers Since 1995
        </p>

        <h1
          className="reveal text-legible mt-8 font-display text-[3.25rem] font-light leading-[0.95] tracking-tighter text-white sm:text-[5rem] lg:text-[8rem]"
          style={{ animationDelay: "0.35s" }}
        >
          Illuminate
          <br />
          <span className="font-serif italic font-light text-gradient-gold">Perfection</span>
          <span className="sr-only">
             &mdash; Cristalux, Luxury Crystal Chandelier Factory &amp; Atelier
          </span>
        </h1>

        <p
          className="reveal text-legible mt-10 max-w-2xl font-serif text-xl italic font-light text-white/70"
          style={{ animationDelay: "0.5s" }}
        >
          The company CRISTALUX, established in 1995, offers you a wide range of chandeliers, ceiling lights, wall lights, lampshades, spotlights, curtains, souvenirs, and decorative tiles, all made of genuine crystal with a sparkling brilliance.
        </p>

        <div
          className="reveal mt-12 flex flex-col items-center gap-8 sm:flex-row"
          style={{ animationDelay: "0.65s" }}
        >
          <GoldButton href={COLLECTION_URL}>Explore Collection</GoldButton>
          <GhostLink href={CATALOGUE_PATH}>View Catalogue</GhostLink>
        </div>
      </div>
    </section>
  );
}
