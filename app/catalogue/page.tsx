import type { Metadata } from "next";
import { preload } from "react-dom";
import PageHero from "@/components/PageHero";
import CatalogueBook from "@/components/CatalogueBook";
import { getCatalogue, isStoreConfigured } from "@/lib/catalogue-store";
import { isImageStoreConfigured } from "@/lib/page-image-store";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Turn the pages of the Cristalux catalogue of hand-cut crystal chandeliers and statement lighting.",
  alternates: { canonical: "/catalogue" },
};

// the published catalogue can change at any moment, so this is rendered per request
export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const catalogue = await getCatalogue().catch(() => null);

  // start fetching the opening spread with the HTML, before the flipbook's JavaScript has even loaded
  for (const page of catalogue?.rendition?.pages.slice(0, 2) ?? []) {
    preload(page.src, { as: "image", fetchPriority: "high" });
  }

  return (
    <PageHero
      label="Full Catalogue"
      title="Turn"
      titleAccent="The Pages"
      description="Browse the latest Cristalux catalogue, page by page."
    >
      <CatalogueBook
        initialCatalogue={catalogue}
        storeConfigured={isStoreConfigured()}
        imageStoreConfigured={isImageStoreConfigured()}
      />
    </PageHero>
  );
}
