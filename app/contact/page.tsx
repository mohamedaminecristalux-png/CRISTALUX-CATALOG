import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact the Cristalux chandelier factory for trade enquiries, bespoke commissions, and restoration work.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <PageHero
      label="Contact"
      title="Speak With"
      titleAccent="The Atelier"
      description="For trade enquiries, bespoke commissions, or restoration work, reach the Cristalux team directly."
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 font-ui text-sm">
        <a
          href="mailto:atelier@cristalux.com"
          className="border-b border-white/20 pb-1 uppercase tracking-[0.2em] text-white transition-colors duration-500 ease-premium hover:border-gold hover:text-gold"
        >
          atelier@cristalux.com
        </a>
        <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">
          Trade &amp; Bespoke Enquiries Only
        </p>
      </div>
    </PageHero>
  );
}
