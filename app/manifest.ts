import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cristalux | Luxury Crystal Chandelier Factory & Atelier",
    short_name: "Cristalux",
    description:
      "Handcrafted crystal chandeliers and bespoke lighting sculptures, engineered by master glassmakers since 1962.",
    start_url: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#080808",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
