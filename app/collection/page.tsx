import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import GoldButton from "@/components/GoldButton";

export const metadata: Metadata = {
  title: "Chandelier Collection",
  description:
    "Browse the Cristalux collection of hand-cut crystal chandeliers, sculptural pendants, and statement lighting, engineered at our atelier-factory for palaces, hotels, and private residences.",
  alternates: { canonical: "/collection" },
};

const CATEGORIES = [
  {
    name: "Crystal Chandeliers",
    copy: "Hand-cut Swarovski and Bohemian crystal, strung on brass and gold-plated armatures by our master glassmakers.",
  },
  {
    name: "Sculptural Pendants",
    copy: "Single-form statement pieces engineered for atriums, stairwells, and double-height lobbies.",
  },
  {
    name: "Restoration & Rewiring",
    copy: "Heritage chandeliers returned to our factory floor for crystal replacement, rewiring, and museum-grade restoration.",
  },
];

export default function CollectionPage() {
  return (
    <PageHero
      label="The Collection"
      title="Light, Cut"
      titleAccent="By Hand"
      description="Every chandelier that leaves the Cristalux factory is assembled, strung, and calibrated by hand at our atelier — no two pieces catch the light the same way."
    >
      <div className="grid gap-6 text-left sm:grid-cols-3">
        {CATEGORIES.map((c) => (
          <div key={c.name} className="glass p-6">
            <h2 className="font-display text-lg font-light text-white">{c.name}</h2>
            <p className="mt-3 font-serif text-sm italic font-light text-white/60">{c.copy}</p>
          </div>
        ))}
      </div>
      <div className="mt-12">
        <GoldButton href="/contact">Request the Catalogue</GoldButton>
      </div>
    </PageHero>
  );
}
