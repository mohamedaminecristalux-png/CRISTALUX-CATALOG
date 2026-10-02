"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PageFlip } from "page-flip";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import CatalogueAdmin from "./CatalogueAdmin";
import { loadPdf, renderPage } from "@/lib/pdf-render";
import { isSafeLinkUrl, type CataloguePage, type CatalogueState } from "@/lib/catalogue-types";

type Book = { key: string; width: number; height: number; pages: CataloguePage[] };

// pages past the current spread whose images start downloading, so a flip never lands on a blank page
const LOOKAHEAD = 6;

function buildPageElement(page: CataloguePage, index: number): { element: HTMLElement; image: HTMLImageElement } {
  const element = document.createElement("div");
  element.className = "catalogue-page bg-white";

  const image = document.createElement("img");
  image.alt = `Page ${index + 1}`;
  image.decoding = "async";
  image.draggable = false;
  image.className = "pointer-events-none h-full w-full select-none";
  if (index < 2) image.setAttribute("fetchpriority", "high");
  element.appendChild(image);

  for (const link of page.links) {
    if (!isSafeLinkUrl(link.url)) continue;
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = "absolute bg-transparent transition-colors hover:bg-gold/10";
    anchor.setAttribute("aria-label", "Open linked page");
    Object.assign(anchor.style, {
      left: `${link.leftPct}%`,
      top: `${link.topPct}%`,
      width: `${link.widthPct}%`,
      height: `${link.heightPct}%`,
    });
    element.appendChild(anchor);
  }
  return { element, image };
}

export default function CatalogueBook({
  initialCatalogue,
  storeConfigured,
  imageStoreConfigured,
}: {
  initialCatalogue: CatalogueState | null;
  storeConfigured: boolean;
  imageStoreConfigured: boolean;
}) {
  const [catalogue, setCatalogue] = useState(initialCatalogue);
  const [renderedBook, setRenderedBook] = useState<Book | null>(null);
  const [renderProgress, setRenderProgress] = useState({ done: 0, total: 0 });
  const [renderError, setRenderError] = useState("");
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);

  const rendition = catalogue?.rendition;
  // catalogues published before pre-rendering existed still have to be rendered from the PDF in the browser
  const fallbackKey = catalogue && !rendition ? catalogue.updatedAt : null;

  const book = useMemo<Book | null>(() => {
    if (rendition) {
      return { key: rendition.version, width: rendition.width, height: rendition.height, pages: rendition.pages };
    }
    return renderedBook && renderedBook.key === fallbackKey ? renderedBook : null;
  }, [rendition, renderedBook, fallbackKey]);

  useEffect(() => {
    if (!fallbackKey) return;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    const objectUrls: string[] = [];

    (async () => {
      // yield once so no state is set synchronously within the effect's call stack
      await Promise.resolve();
      setRenderProgress({ done: 0, total: 0 });
      setRenderError("");
      try {
        // the version param keeps the CDN from serving a previous catalogue's cached PDF
        task = await loadPdf(`/api/catalogue/pdf?v=${encodeURIComponent(fallbackKey)}`);
        if (cancelled) return;
        const pdf = await task.promise;
        const pages: CataloguePage[] = [];
        let size: { width: number; height: number } | null = null;
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await renderPage(pdf, n);
          if (cancelled) return;
          const src = URL.createObjectURL(page.image);
          objectUrls.push(src);
          pages.push({ src, links: page.links });
          size ??= { width: page.width, height: page.height };
          setRenderProgress({ done: n, total: pdf.numPages });
        }
        if (!cancelled && size) setRenderedBook({ key: fallbackKey, ...size, pages });
      } catch (err) {
        if (!cancelled) setRenderError(err instanceof Error ? err.message : "Couldn't load the catalogue PDF.");
      } finally {
        void task?.destroy();
      }
    })();

    return () => {
      cancelled = true;
      // aborts an in-flight PDF download instead of letting it finish in the background
      void task?.destroy();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [fallbackKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!book || !host) return;

    // page-flip re-parents the page elements and removes its root on destroy(), so the whole
    // book lives in a subtree that React never renders into
    const root = document.createElement("div");
    host.appendChild(root);
    const built = book.pages.map(buildPageElement);

    const loadAround = (index: number) => {
      const last = Math.min(book.pages.length - 1, index + LOOKAHEAD);
      for (let i = Math.max(0, index - 2); i <= last; i++) {
        if (!built[i].image.getAttribute("src")) built[i].image.src = book.pages[i].src;
      }
    };
    loadAround(0);

    let flip: PageFlip | null = null;
    let cancelled = false;
    import("page-flip").then(({ PageFlip }) => {
      if (cancelled) return;
      flip = new PageFlip(root, {
        width: book.width,
        height: book.height,
        size: "stretch",
        minWidth: 280,
        maxWidth: 1400,
        minHeight: 360,
        maxHeight: 1800,
        maxShadowOpacity: 0.4,
        showCover: false,
        mobileScrollSupport: true,
        clickEventForward: true,
      });
      flip.on("flip", (e) => {
        const index = typeof e.data === "number" ? e.data : 0;
        setCurrentPage(index);
        loadAround(index);
      });
      flip.loadFromHTML(built.map((b) => b.element));
      flipRef.current = flip;
      setCurrentPage(0);
      setReadyKey(book.key);
    });

    return () => {
      cancelled = true;
      flipRef.current = null;
      if (flip) flip.destroy();
      else root.remove();
    };
  }, [book]);

  const ready = book !== null && readyKey === book.key;
  let notice: string | null = null;
  if (!storeConfigured) notice = "Catalogue storage isn't configured on this deployment yet.";
  else if (!catalogue) notice = "No catalogue has been published yet.";
  else if (renderError) notice = renderError;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
      {notice && (
        <p className="max-w-md py-16 text-center font-serif text-base italic font-light text-white/50">
          {notice}
        </p>
      )}

      {!notice && !ready && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-6 w-6 animate-spin rounded-full border border-gold/30 border-t-gold" />
          <p className="font-ui text-[10px] uppercase tracking-[0.25em] text-white/40">
            {!rendition && renderProgress.total > 0
              ? `Rendering page ${renderProgress.done} / ${renderProgress.total}`
              : "Loading catalogue"}
          </p>
        </div>
      )}

      {/* never display:none: page-flip measures this box's width when it initializes */}
      <div ref={hostRef} className="w-full" aria-label="Catalogue" />

      {ready && (
        <div className="mt-6 flex items-center gap-6 font-ui text-[10px] uppercase tracking-[0.25em] text-white/50">
          <button
            type="button"
            onClick={() => flipRef.current?.flipPrev()}
            className="transition-colors hover:text-gold"
          >
            &larr; Prev
          </button>
          <span>
            Page {currentPage + 1} / {book.pages.length}
          </span>
          <button
            type="button"
            onClick={() => flipRef.current?.flipNext()}
            className="transition-colors hover:text-gold"
          >
            Next &rarr;
          </button>
        </div>
      )}

      <CatalogueAdmin
        storeConfigured={storeConfigured}
        imageStoreConfigured={imageStoreConfigured}
        onPublished={setCatalogue}
      />
    </div>
  );
}
