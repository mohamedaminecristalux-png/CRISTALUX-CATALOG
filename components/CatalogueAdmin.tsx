"use client";

import { useState } from "react";
import { extractDriveFileId } from "@/lib/drive-link";
import { loadPdf, readWithProgress, renderPage, type RenderedPage } from "@/lib/pdf-render";
import {
  PASSWORD_HEADER,
  PDF_SIZE_HEADER,
  type CataloguePage,
  type CatalogueRendition,
  type CatalogueState,
} from "@/lib/catalogue-types";

// rendering runs ahead of the uploads by at most this many pages, bounding memory and parallel requests
const MAX_PARALLEL_UPLOADS = 4;

const toMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

async function errorFrom(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

async function uploadPage(
  version: string,
  index: number,
  page: RenderedPage,
  password: string
): Promise<CataloguePage> {
  const res = await fetch(`/api/catalogue/pages/${version}/${index}`, {
    method: "PUT",
    headers: { [PASSWORD_HEADER]: encodeURIComponent(password), "Content-Type": page.image.type },
    body: page.image,
  });
  if (!res.ok) throw new Error(await errorFrom(res, `Couldn't upload page ${index + 1}.`));
  const { url } = await res.json();
  return { src: url, links: page.links };
}

/** Renders every PDF page to an image once, here, so visitors only ever download lightweight images. */
async function renderAndUpload(
  fileId: string,
  password: string,
  onStatus: (text: string) => void
): Promise<CatalogueRendition> {
  onStatus("Downloading PDF");
  const res = await fetch(`/api/catalogue/pdf?id=${encodeURIComponent(fileId)}`, {
    headers: { [PASSWORD_HEADER]: encodeURIComponent(password) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await errorFrom(res, "Couldn't download the PDF."));

  const totalBytes = Number(res.headers.get(PDF_SIZE_HEADER)) || 0;
  const data = await readWithProgress(res, totalBytes, (received, total) =>
    onStatus(
      total > 0
        ? `Downloading PDF ${toMb(received)} / ${toMb(total)} MB`
        : `Downloading PDF ${toMb(received)} MB`
    )
  );

  const task = await loadPdf(data);
  try {
    const pdf = await task.promise;
    const version = crypto.randomUUID();
    const uploads: Promise<CataloguePage>[] = [];
    let size: { width: number; height: number } | null = null;

    for (let n = 1; n <= pdf.numPages; n++) {
      onStatus(`Preparing page ${n} / ${pdf.numPages}`);
      const page = await renderPage(pdf, n);
      size ??= { width: page.width, height: page.height };

      const upload = uploadPage(version, n - 1, page, password);
      // failures surface through the awaits below; this only stops one being reported as unhandled first
      upload.catch(() => {});
      uploads.push(upload);
      if (uploads.length > MAX_PARALLEL_UPLOADS) await uploads[uploads.length - 1 - MAX_PARALLEL_UPLOADS];
    }

    onStatus("Finishing upload");
    const pages = await Promise.all(uploads);
    return { version, width: size!.width, height: size!.height, pages };
  } finally {
    void task.destroy();
  }
}

export default function CatalogueAdmin({
  storeConfigured,
  imageStoreConfigured,
  onPublished,
}: {
  storeConfigured: boolean;
  imageStoreConfigured: boolean;
  onPublished: (catalogue: CatalogueState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // fail before the minute-long render and upload rather than at the final save
    if (!storeConfigured) {
      setMessage({
        kind: "error",
        text: "Storage isn't configured on this deployment yet. Connect an Upstash Redis store in Vercel, then redeploy.",
      });
      return;
    }
    const fileId = extractDriveFileId(driveLink);
    if (!fileId) {
      setMessage({ kind: "error", text: "Couldn't find a file ID in that Google Drive link." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const rendition = imageStoreConfigured
        ? await renderAndUpload(fileId, password, setStatus)
        : undefined;

      setStatus("Publishing");
      const res = await fetch("/api/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, driveLink, rendition }),
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: await errorFrom(res, "Something went wrong.") });
        return;
      }
      const data = await res.json();
      setMessage({
        kind: "success",
        text: rendition
          ? "Catalogue updated."
          : "Catalogue updated. Connect a Vercel Blob store so it loads instantly.",
      });
      setPassword("");
      setDriveLink("");
      onPublished(data.catalogue);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Couldn't reach the server." });
    } finally {
      setSubmitting(false);
      setStatus("");
    }
  }

  return (
    <div className="mt-10 w-full max-w-sm border-t border-white/10 pt-6 text-center">
      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          setOpen((v) => !v);
          setMessage(null);
        }}
        className="font-ui text-[10px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-white/60 disabled:opacity-50"
      >
        {open ? "Cancel" : "Update catalogue"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 text-left">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoComplete="off"
            className="glass px-4 py-3 font-ui text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
          <input
            type="url"
            required
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="Google Drive PDF link"
            className="glass px-4 py-3 font-ui text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-gold px-4 py-3 font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #c5a059 0%, #b8860b 100%)" }}
          >
            {submitting ? "Publishing..." : "Publish"}
          </button>
          {submitting && status && (
            <p className="font-ui text-[10px] uppercase tracking-[0.15em] text-white/50">
              {status} &mdash; keep this tab open
            </p>
          )}
          {message && (
            <p
              className={`font-ui text-[10px] uppercase tracking-[0.15em] ${
                message.kind === "error" ? "text-red-400" : "text-gold"
              }`}
            >
              {message.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
