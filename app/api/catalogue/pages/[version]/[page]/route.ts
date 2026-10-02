import { NextRequest, NextResponse } from "next/server";
import { passwordFromHeader, rejectUnlessAdmin } from "@/lib/admin-auth";
import {
  isImageStoreConfigured,
  PAGE_CONTENT_TYPES,
  readLocalPageImage,
  savePageImage,
} from "@/lib/page-image-store";
import { VERSION_PATTERN } from "@/lib/catalogue-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ version: string; page: string }> };

// Vercel rejects function request bodies over 4.5 MB; a rendered page is normally a few hundred KB
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

/** Uploads one pre-rendered catalogue page (admin only). */
export async function PUT(request: NextRequest, { params }: Params) {
  const denied = rejectUnlessAdmin(passwordFromHeader(request));
  if (denied) return denied;
  if (!isImageStoreConfigured()) {
    return NextResponse.json({ error: "Image storage isn't configured on the server." }, { status: 500 });
  }

  const { version, page } = await params;
  if (!VERSION_PATTERN.test(version) || !/^\d{1,4}$/.test(page)) {
    return NextResponse.json({ error: "Invalid page address." }, { status: 400 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!PAGE_CONTENT_TYPES[contentType]) {
    return NextResponse.json({ error: "Pages must be WebP or JPEG images." }, { status: 415 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_PAGE_BYTES) {
    return NextResponse.json({ error: "Page image is empty or too large." }, { status: 413 });
  }

  const url = await savePageImage(version, Number(page), contentType, body);
  return NextResponse.json({ url });
}

/** Serves page images saved to disk under `next dev` (in production they're served by Vercel Blob). */
export async function GET(_request: NextRequest, { params }: Params) {
  const { version, page } = await params;
  const image = await readLocalPageImage(version, page);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
