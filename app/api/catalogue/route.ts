import { NextRequest, NextResponse } from "next/server";
import { getCatalogue, setCatalogue, isStoreConfigured } from "@/lib/catalogue-store";
import { deleteOtherVersions, isImageStoreConfigured } from "@/lib/page-image-store";
import { rejectUnlessAdmin } from "@/lib/admin-auth";
import { extractDriveFileId } from "@/lib/drive-link";
import {
  isSafeLinkUrl,
  VERSION_PATTERN,
  type CatalogueLink,
  type CatalogueRendition,
  type CatalogueState,
} from "@/lib/catalogue-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const catalogue = await getCatalogue();
  return NextResponse.json({
    catalogue,
    storeConfigured: isStoreConfigured(),
    imageStoreConfigured: isImageStoreConfigured(),
  });
}

const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const isFiniteNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function parseLink(value: unknown): CatalogueLink | null {
  const l = value as Partial<CatalogueLink> | null;
  if (!l || typeof l.url !== "string" || !isSafeLinkUrl(l.url)) return null;
  if (![l.leftPct, l.topPct, l.widthPct, l.heightPct].every(isFiniteNumber)) return null;
  return {
    url: l.url,
    leftPct: l.leftPct!,
    topPct: l.topPct!,
    widthPct: l.widthPct!,
    heightPct: l.heightPct!,
  };
}

/** The rendition comes from the admin's browser, so only well-formed page images and safe links get stored. */
function parseRendition(value: unknown): CatalogueRendition | null {
  const r = value as Partial<CatalogueRendition> | null;
  if (!r || typeof r.version !== "string" || !VERSION_PATTERN.test(r.version)) return null;
  if (!isPositive(r.width) || !isPositive(r.height)) return null;
  if (!Array.isArray(r.pages) || r.pages.length === 0 || r.pages.length > 2000) return null;

  const pages: CatalogueRendition["pages"] = [];
  for (const page of r.pages) {
    const src = page?.src;
    if (typeof src !== "string" || !(src.startsWith("https://") || src.startsWith("/api/catalogue/pages/"))) {
      return null;
    }
    if (!Array.isArray(page.links)) return null;
    const links = page.links.map(parseLink);
    if (links.some((l) => l === null)) return null;
    pages.push({ src, links: links as CatalogueLink[] });
  }
  return { version: r.version, width: r.width, height: r.height, pages };
}

export async function POST(request: NextRequest) {
  let body: { password?: unknown; driveLink?: unknown; rendition?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const driveLink = typeof body.driveLink === "string" ? body.driveLink : "";

  if (!password || !driveLink) {
    return NextResponse.json({ error: "Password and Drive link are required." }, { status: 400 });
  }
  const denied = rejectUnlessAdmin(password);
  if (denied) return denied;

  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: "Storage isn't configured on the server yet (Upstash Redis env vars missing)." },
      { status: 500 }
    );
  }

  const fileId = extractDriveFileId(driveLink);
  if (!fileId) {
    return NextResponse.json(
      { error: "Couldn't find a file ID in that Google Drive link." },
      { status: 400 }
    );
  }

  let rendition: CatalogueRendition | undefined;
  if (body.rendition !== undefined) {
    const parsed = parseRendition(body.rendition);
    if (!parsed) {
      return NextResponse.json({ error: "The rendered pages were malformed." }, { status: 400 });
    }
    rendition = parsed;
  }

  const state: CatalogueState = { driveFileId: fileId, updatedAt: new Date().toISOString(), rendition };
  await setCatalogue(state);

  if (rendition && isImageStoreConfigured()) {
    // the new catalogue is already live, so a failed cleanup only leaves unused images behind
    await deleteOtherVersions(rendition.version).catch((err) =>
      console.error("Couldn't delete old catalogue images", err)
    );
  }

  return NextResponse.json({ ok: true, catalogue: state });
}
