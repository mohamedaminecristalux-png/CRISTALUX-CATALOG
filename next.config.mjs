/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // the site now only leads to the catalogue; old section URLs bounce there or home
  async redirects() {
    return [
      { source: "/collection", destination: "/catalogue", permanent: false },
      { source: "/atelier", destination: "/", permanent: false },
      { source: "/heritage", destination: "/", permanent: false },
      { source: "/bespoke", destination: "/", permanent: false },
      { source: "/contact", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
