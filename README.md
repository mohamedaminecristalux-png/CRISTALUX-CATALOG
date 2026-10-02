# Cristalux

Luxury crystal chandelier factory & atelier site, built as the "Lumina" design
system: deep charcoal + metallic gold, Space Grotesk / Crimson Pro / Public
Sans typography, an interactive Three.js tube background, and long-ease reveal
animations.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **React 19**
- **Tailwind CSS** for the design tokens (charcoal/gold palette, tracking scale, `ease-premium` timing)
- **@react-three/fiber + three.js** for the interactive 3D tube background
- **next/font** for self-hosted Google Fonts (no render-blocking font requests)
- **next/og** for a generated Open Graph/Twitter share image (no static asset to maintain)

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Hero landing page — "Explore Collection" goes to the online lustres collection, "View Catalogue" to `/catalogue` |
| `/catalogue` | Flipbook catalogue (changeable PDF) |

The site has a single job: getting visitors to the catalogue. Both destinations
live in `lib/links.ts`. The old section URLs (`/collection`, `/atelier`,
`/heritage`, `/bespoke`, `/contact`) redirect to `/catalogue` or `/` via
`next.config.mjs`.

`/sitemap.xml`, `/robots.txt`, and `/manifest.webmanifest` are generated
automatically from `app/sitemap.ts`, `app/robots.ts`, and `app/manifest.ts`.

## Catalogue flipbook (`/catalogue`)

`/catalogue` turns a Google Drive PDF into an
animated, page-by-page flipbook (`page-flip` engine) with clickable hyperlinks
preserved from the PDF. Only someone with the admin password can change which
PDF is shown — the "Update catalogue" link at the bottom of the book reveals a
password + Google Drive link form.

**How it works — the PDF is rendered once, at publish time, never per visitor:**
- Publishing (`components/CatalogueAdmin.tsx`) runs in the admin's browser:
  it downloads the PDF through `GET /api/catalogue/pdf?id=…` (password-gated),
  renders every page to a ~70 KB WebP image with `pdfjs-dist` (link
  annotations kept), and uploads each one via
  `PUT /api/catalogue/pages/[version]/[page]` to Vercel Blob. Finally
  `POST /api/catalogue` stores the page list in Redis and deletes the previous
  catalogue's images. A 35 MB / 74-page PDF takes about a minute, once.
- Visitors (`components/CatalogueBook.tsx`) only load those images: the
  opening spread is preloaded with the HTML and the next few pages are fetched
  as they flip. No PDF download, no in-browser rendering — the book shows in
  about a second.
- `/catalogue` itself is a static page served from Vercel's edge cache, so a
  visit never waits on a function cold start; publishing calls
  `revalidatePath("/catalogue")` to rebuild it. The previous version's images
  are kept until the next publish, for visitors still on the old page.
- Functions run in Paris (`cdg1`, set in `vercel.json`), close to the
  Tunisian audience — create the Redis database in a European region too.
- Catalogues published before pre-rendering existed (or with no Blob store
  connected) still work through the old path — the browser downloads and
  renders the whole PDF — which is slow. **Republish once** to switch over.
- `GET /api/catalogue/pdf` proxies the PDF bytes from Google Drive so the
  browser never hits Drive directly (avoids CORS and handles Drive's
  large-file "can't scan for viruses" interstitial).

**Local development:** just set `CATALOGUE_ADMIN_PASSWORD` in `.env.local` —
no database needed. Without `UPSTASH_REDIS_REST_URL`/`_TOKEN` and
`BLOB_READ_WRITE_TOKEN`, the catalogue state and the page images fall back to
files on disk (`.data/catalogue.json` and `.data/catalogue-pages/`, gitignored)
so the whole flow works out of the box with `npm run dev`. Don't point a local
`next dev` at the production Redis without also setting the Blob token, or a
local publish would store page URLs that only exist on your machine.

**Production setup on Vercel (three things, one time only):**
1. **Storage** — in the Vercel dashboard: *Storage → Create Database →
   Upstash for Redis*. Connect it to this project (Production checked, no
   custom prefix); Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`
   automatically (`UPSTASH_REDIS_REST_URL` / `_TOKEN` also work). This is
   required in production — Vercel's serverless filesystem is read-only and
   ephemeral, so the local-file fallback only works for `next dev`.
2. **Page images** — *Storage → Create → Blob*, connected to this project;
   Vercel injects `BLOB_READ_WRITE_TOKEN`. Without it the catalogue still
   publishes, but every visitor has to download and render the full PDF.
3. **Admin password** — set `CATALOGUE_ADMIN_PASSWORD` under
   **Project Settings → Environment Variables** to whatever passphrase you want
   to gate publishing with.

Redeploy after connecting storage so the new variables are picked up, then
republish the catalogue once from `/catalogue`.

The Google Drive file must be shared as "Anyone with the link can view".

## Local development

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

## SEO checklist already wired up

- Per-page `<title>`/description via the App Router `metadata` API, with a
  shared title template (`%s | Cristalux`) in `app/layout.tsx`.
- `Organization` + `LocalBusiness`/`Factory` JSON-LD structured data in
  `app/layout.tsx`, so Google can attribute the site to a real chandelier
  manufacturer.
- Auto-generated `sitemap.xml` and `robots.txt` (`app/sitemap.ts`, `app/robots.ts`).
- Auto-generated favicon, apple touch icon, and OG/Twitter share image
  (`app/opengraph-image.tsx`, `public/icon-*.png`) — nothing to hand-export.
- Single `<h1>` per page, semantic heading order, `lang="en"`, visible focus
  states inherited from default browser styles.
- `prefers-reduced-motion` support for the reveal animations in `app/globals.css`.
- Security headers (`X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) set in `next.config.mjs`.
- Every internal header/footer link resolves to a real page — no dead links.

**Before going live**, set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) to the
real production domain — it feeds the canonical URLs, sitemap, and
Open Graph metadata.

## Deploying to Vercel

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. In the [Vercel dashboard](https://vercel.com/new), import the repository —
   it is auto-detected as a Next.js app, no build configuration needed.
3. Add the `NEXT_PUBLIC_SITE_URL` environment variable under
   **Project Settings → Environment Variables** with your production domain.
4. Deploy. Every push to the main branch redeploys automatically; every PR
   gets its own preview URL.
5. Once you attach a custom domain in **Project Settings → Domains**, update
   `NEXT_PUBLIC_SITE_URL` to match and redeploy so canonical/OG URLs stay correct.

Or from the CLI:

```bash
npm i -g vercel
vercel        # first deploy, links the project
vercel --prod # promote to production
```
