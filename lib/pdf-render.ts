// Browser-only: rasterizes PDF pages with pdf.js.
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { CatalogueLink } from "./catalogue-types";

export const RENDER_WIDTH = 1000;

export type RenderedPage = {
  image: Blob;
  links: CatalogueLink[];
  width: number;
  height: number;
};

/** Starts loading a PDF; `destroy()` on the returned task aborts the download and frees the worker. */
export async function loadPdf(source: Uint8Array | string): Promise<PDFDocumentLoadingTask> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjsLib.getDocument(typeof source === "string" ? { url: source } : { data: source });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  // WebP is far smaller than PNG, but Safari can't encode it and silently returns a PNG instead
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Couldn't rasterize a page.");
  return jpeg;
}

export async function renderPage(pdf: PDFDocumentProxy, pageNumber: number): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: RENDER_WIDTH / baseViewport.width });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const links: CatalogueLink[] = [];
  for (const annotation of await page.getAnnotations()) {
    const url = annotation.url as string | undefined;
    if (annotation.subtype !== "Link" || !url) continue;
    const [rx0, ry0] = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]);
    const [rx1, ry1] = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3]);
    const x0 = Math.min(rx0, rx1);
    const x1 = Math.max(rx0, rx1);
    const y0 = Math.min(ry0, ry1);
    const y1 = Math.max(ry0, ry1);
    links.push({
      url,
      leftPct: (x0 / viewport.width) * 100,
      topPct: (y0 / viewport.height) * 100,
      widthPct: ((x1 - x0) / viewport.width) * 100,
      heightPct: ((y1 - y0) / viewport.height) * 100,
    });
  }

  const image = await encode(canvas);
  // free the bitmap now rather than whenever GC gets to it; catalogues can run to dozens of pages
  canvas.width = 0;
  canvas.height = 0;
  page.cleanup();

  return { image, links, width: viewport.width, height: viewport.height };
}

/** Reads a response body to the end, reporting progress against the size the PDF route advertises. */
export async function readWithProgress(
  response: Response,
  totalBytes: number,
  onProgress: (received: number, total: number) => void
): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received, totalBytes);
  }

  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
}
