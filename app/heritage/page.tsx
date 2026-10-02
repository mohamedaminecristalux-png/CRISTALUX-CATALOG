import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Heritage",
  description:
    "Since 1962, Cristalux has manufactured crystal chandeliers from a single factory, passing techniques between generations of glassmakers and lighting engineers.",
  alternates: { canonical: "/heritage" },
};

export default function HeritagePage() {
  return (
    <PageHero
      label="Since 1962"
      title="Three Generations"
      titleAccent="Of Glasswork"
      description="Cristalux began as a two-room glass workshop and grew into a full lighting factory, without ever moving production away from the hands that started it."
    >
      <div className="mx-auto max-w-2xl text-left">
        <p className="font-serif text-base italic font-light leading-relaxed text-white/60">
          What started as a family workshop cutting crystal for local ballrooms has become a
          factory trusted by hotels, palaces, and collectors across the world. The tools have
          changed — the hands, and the standards, have not. Every apprentice at Cristalux still
          learns to cut and string crystal before they touch a single blueprint.
        </p>
      </div>
    </PageHero>
  );
}
