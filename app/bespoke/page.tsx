import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import GoldButton from "@/components/GoldButton";

export const metadata: Metadata = {
  title: "Bespoke Commissions",
  description:
    "Commission a bespoke crystal chandelier from the Cristalux factory — custom scale, finish, and crystal cut, designed with architects and interior teams from first sketch to installation.",
  alternates: { canonical: "/bespoke" },
};

export default function BespokePage() {
  return (
    <PageHero
      label="Bespoke"
      title="Built To Your"
      titleAccent="Architecture"
      description="Our bespoke desk works directly with architects and designers to engineer chandeliers for a specific stairwell, ceiling height, or brief — nothing off the shelf."
    >
      <GoldButton href="/contact">Start a Commission</GoldButton>
    </PageHero>
  );
}
