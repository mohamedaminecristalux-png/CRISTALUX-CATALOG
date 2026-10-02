import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Crimson_Pro, Public_Sans } from "next/font/google";
import CursorLight from "@/components/CursorLight";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  weight: ["200", "400"],
  style: ["normal", "italic"],
  variable: "--font-crimson-pro",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-public-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.cristalux.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cristalux | Luxury Crystal Chandelier Factory & Atelier",
    template: "%s | Cristalux",
  },
  description:
    "Cristalux is a luxury crystal chandelier factory and atelier, handcrafting bespoke lighting sculptures for palaces, hotels, and private residences since 1962. Explore our collection and browse the full catalogue.",
  keywords: [
    "chandelier factory",
    "luxury chandeliers",
    "crystal chandelier manufacturer",
    "bespoke chandeliers",
    "handmade crystal lighting",
    "custom chandelier atelier",
    "high-end lighting fixtures",
    "Cristalux",
  ],
  authors: [{ name: "Cristalux" }],
  creator: "Cristalux",
  publisher: "Cristalux",
  category: "Home & Lighting Manufacturing",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Cristalux",
    title: "Cristalux | Luxury Crystal Chandelier Factory & Atelier",
    description:
      "Handcrafted crystal chandeliers and bespoke lighting sculptures, engineered by master glassmakers since 1962.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cristalux | Luxury Crystal Chandelier Factory & Atelier",
    description:
      "Handcrafted crystal chandeliers and bespoke lighting sculptures, engineered by master glassmakers since 1962.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Cristalux",
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  description:
    "Cristalux is a luxury crystal chandelier factory and atelier, handcrafting bespoke lighting sculptures for palaces, hotels, and private residences since 1962.",
  foundingDate: "1962",
  makesOffer: {
    "@type": "Offer",
    itemOffered: {
      "@type": "Product",
      name: "Bespoke Crystal Chandeliers",
      category: "Lighting Fixtures",
      brand: {
        "@type": "Brand",
        name: "Cristalux",
      },
    },
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "Factory"],
  "@id": `${SITE_URL}/#factory`,
  name: "Cristalux Chandelier Factory",
  image: `${SITE_URL}/og-image.jpg`,
  url: SITE_URL,
  priceRange: "$$$$",
  description:
    "A luxury chandelier factory and atelier producing hand-cut crystal lighting sculptures for high-end residential and hospitality projects worldwide.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${spaceGrotesk.variable} ${crimsonPro.variable} ${publicSans.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </head>
      <body className="font-ui antialiased">
        {children}
        <CursorLight />
      </body>
    </html>
  );
}
