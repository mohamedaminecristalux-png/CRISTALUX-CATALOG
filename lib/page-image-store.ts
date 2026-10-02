import { del, list, put } from "@vercel/blob";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { VERSION_PATTERN } from "./catalogue-types";

const BLOB_PREFIX = "catalogue/";
const LOCAL_DIR = path.join(process.cwd(), ".data", "catalogue-pages");
const LOCAL_FILE_PATTERN = /^\d{1,4}\.(webp|jpg)$/;

export const PAGE_CONTENT_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Same reasoning as the catalogue store: a local folder only works under `next dev`, never on Vercel. */
function canUseLocalFile(): boolean {
  return !process.env.VERCEL;
}

export function isImageStoreConfigured(): boolean {
  return hasBlob() || canUseLocalFile();
}

/** Stores one rendered page and returns the public URL visitors load it from. */
export async function savePageImage(
  version: string,
  index: number,
  contentType: string,
  body: ArrayBuffer
): Promise<string> {
  const file = `${index}.${PAGE_CONTENT_TYPES[contentType]}`;

  if (hasBlob()) {
    const blob = await put(`${BLOB_PREFIX}${version}/${file}`, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      // every publish writes under a fresh version, so a URL's content never changes
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }
  if (canUseLocalFile()) {
    const dir = path.join(LOCAL_DIR, version);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, file), Buffer.from(body));
    return `/api/catalogue/pages/${version}/${file}`;
  }
  throw new Error("Image storage is not configured");
}

export async function readLocalPageImage(
  version: string,
  file: string
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!canUseLocalFile() || !VERSION_PATTERN.test(version) || !LOCAL_FILE_PATTERN.test(file)) return null;
  try {
    const body = await readFile(path.join(LOCAL_DIR, version, file));
    return { body, contentType: file.endsWith(".webp") ? "image/webp" : "image/jpeg" };
  } catch {
    return null;
  }
}

/** Deletes the images of every version not in `keepVersions` (old catalogues and abandoned publishes). */
export async function deleteVersionsExcept(keepVersions: string[]): Promise<void> {
  if (hasBlob()) {
    const stale: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BLOB_PREFIX, cursor });
      for (const blob of page.blobs) {
        const version = blob.pathname.slice(BLOB_PREFIX.length).split("/")[0];
        if (!keepVersions.includes(version)) stale.push(blob.url);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    if (stale.length > 0) await del(stale);
    return;
  }
  if (canUseLocalFile()) {
    const versions = await readdir(LOCAL_DIR).catch(() => [] as string[]);
    await Promise.all(
      versions
        .filter((v) => !keepVersions.includes(v))
        .map((v) => rm(path.join(LOCAL_DIR, v), { recursive: true, force: true }))
    );
  }
}
