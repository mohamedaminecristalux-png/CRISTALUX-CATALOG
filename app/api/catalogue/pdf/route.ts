import { NextRequest, NextResponse } from "next/server";
import { getCatalogue } from "@/lib/catalogue-store";
import { passwordFromHeader, rejectUnlessAdmin } from "@/lib/admin-auth";
import { PDF_SIZE_HEADER } from "@/lib/catalogue-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DRIVE_FILE_ID = /^[a-zA-Z0-9_-]{10,}$/;

/**
 * Google Drive's public download flow has two shapes depending on file size:
 * small files stream straight back, large ones first show an HTML "can't scan
 * for viruses" interstitial that has to be bypassed with a confirm token.
 */
async function fetchFromDrive(fileId: string): Promise<Response> {
  const modern = await fetch(
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    { redirect: "follow" }
  );
  const modernType = modern.headers.get("content-type") ?? "";
  if (modernType.includes("pdf") || modernType.includes("octet-stream")) {
    return modern;
  }

  let response = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
    redirect: "follow",
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const html = await response.text();
    const tokenMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);
    if (tokenMatch) {
      response = await fetch(
        `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${tokenMatch[1]}`,
        { redirect: "follow" }
      );
    }
  }
  return response;
}

export async function GET(request: NextRequest) {
  // `?id=` fetches a not-yet-published file for the admin to render; it's password-gated
  // so this route can't be used as an open proxy for arbitrary Drive files
  const requestedId = request.nextUrl.searchParams.get("id");
  let fileId: string;
  if (requestedId) {
    const denied = rejectUnlessAdmin(passwordFromHeader(request));
    if (denied) return denied;
    if (!DRIVE_FILE_ID.test(requestedId)) {
      return NextResponse.json({ error: "Invalid Google Drive file ID." }, { status: 400 });
    }
    fileId = requestedId;
  } else {
    const catalogue = await getCatalogue();
    if (!catalogue) {
      return NextResponse.json({ error: "No catalogue has been published yet." }, { status: 404 });
    }
    fileId = catalogue.driveFileId;
  }

  let driveResponse: Response;
  try {
    driveResponse = await fetchFromDrive(fileId);
  } catch {
    return NextResponse.json({ error: "Couldn't reach Google Drive." }, { status: 502 });
  }

  if (!driveResponse.ok || !driveResponse.body) {
    return NextResponse.json(
      { error: "Couldn't fetch the PDF from Google Drive. Check the file is shared publicly." },
      { status: 502 }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Cache-Control": requestedId
      ? "no-store"
      : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  };
  const size = driveResponse.headers.get("content-length");
  if (size) headers[PDF_SIZE_HEADER] = size;

  return new NextResponse(driveResponse.body, { headers });
}
