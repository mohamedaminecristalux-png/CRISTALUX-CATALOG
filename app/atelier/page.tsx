import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "The Atelier & Factory",
  description:
    "Inside the Cristalux chandelier factory: master glassmakers, brass foundry work, and hand-strung crystal assembly, where every fixture is engineered before it is beautiful.",
  alternates: { canonical: "/atelier" },
};

const STAGES = [
  { step: "01", title: "Cast & Cut", copy: "Brass armatures are cast in-house; crystal is hand-cut and faceted for maximum refraction." },
  { step: "02", title: "Gild & Finish", copy: "Metalwork is gold-plated or aged by hand, finished to a mirror or antiqued patina." },
  { step: "03", title: "String & Balance", copy: "Each strand of crystal is strung, weighted, and balanced individually by a master stringer." },
  { step: "04", title: "Wire & Test", copy: "Fixtures are wired to code, load-tested, and burned in before they ever leave the factory floor." },
];

export default function AtelierPage() {
  return (
    <PageHero
      label="The Atelier"
      title="Engineered"
      titleAccent="Before Beautiful"
      description="The Cristalux factory pairs traditional glasswork with modern lighting engineering — every chandelier is built, tested, and signed off by hand."
    >
      <div className="grid gap-8 text-left sm:grid-cols-2">
        {STAGES.map((s) => (
          <div key={s.step} className="flex gap-5">
            <span className="font-display text-2xl font-light text-gold">{s.step}</span>
            <div>
              <h2 className="font-display text-lg font-light text-white">{s.title}</h2>
              <p className="mt-2 font-serif text-sm italic font-light text-white/60">{s.copy}</p>
            </div>
          </div>
        ))}
      </div>
    </PageHero>
  );
}
