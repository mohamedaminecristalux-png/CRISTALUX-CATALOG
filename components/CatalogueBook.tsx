"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PageFlip } from "page-flip";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import CatalogueAdmin from "./CatalogueAdmin";
import { loadPdf, renderPage } from "@/lib/pdf-render";
import { isSafeLinkUrl, type CataloguePage, type CatalogueState } from "@/lib/catalogue-types";

type Book = { key: string; width: number; height: number; pages: CataloguePage[] };
type Orientation = "portrait" | "landscape";

// pages past the current spread whose images start downloading, so a flip never lands on a blank page
const LOOKAHEAD = 6;
// once the book is open, the rest of its pages download this many at a time at low priority,
// so a jump to any page is instant without slowing down the spread on screen
const BACKGROUND_DOWNLOADS = 3;
// how long a jump waits for the destination spread's images before flipping to it anyway
const JUMP_WAIT_MS = 1500;
// page-flip shows single pages once the book is narrower than two of these (mirrored in .catalogue-preview)
const MIN_PAGE_WIDTH = 280;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves once every image is decoded (or failed), or after `ms` at the latest. */
function decoded(images: HTMLImageElement[], ms: number): Promise<unknown> {
  return Promise.race([Promise.all(images.map((image) => image.decode().catch(() => {}))), delay(ms)]);
}

function settled(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

function prefersSavingData(): boolean {
  const { connection } = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
  return connection?.saveData === true || /2g/.test(connection?.effectiveType ?? "");
}

function buildPageElement(page: CataloguePage, index: number): { element: HTMLElement; image: HTMLImageElement } {
  const element = document.createElement("div");
  element.className = "catalogue-page bg-white";

  const image = document.createElement("img");
  image.alt = `Page ${index + 1}`;
  image.decoding = "async";
  image.draggable = false;
  image.className = "pointer-events-none h-full w-full select-none";
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

/** The opening spread as plain images, so the book is on screen with the HTML rather than once page-flip has loaded. */
function OpeningSpread({ book }: { book: Book }) {
  const style = {
    "--page-ratio": `${book.width} / ${book.height}`,
    "--spread-ratio": `${book.width * 2} / ${book.height}`,
  } as CSSProperties;
  return (
    <div className="catalogue-preview" style={style}>
      <div className="catalogue-preview__spread">
        {book.pages.slice(0, 2).map((page, index) => (
          // eslint-disable-next-line @next/next/no-img-element -- the pages are already small WebPs, preloaded with the HTML
          <img
            key={page.src}
            src={page.src}
            alt={`Page ${index + 1}`}
            fetchPriority="high"
            draggable={false}
            className="select-none bg-white"
          />
        ))}
      </div>
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="transition-colors hover:text-gold disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
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
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  // what's being typed into the page box, until it's submitted or the box loses focus
  const [draft, setDraft] = useState<string | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const goToRef = useRef<((page: number) => Promise<void>) | null>(null);

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
    const images = built.map((b) => b.image);
    const last = book.pages.length - 1;

    // images only get a src once they're wanted: the open spread first, then its neighbours,
    // then (in the background) everything else
    const request = (index: number, priority: "high" | "low" | "auto") => {
      const image = images[index];
      if (!image || image.getAttribute("src")) return;
      image.fetchPriority = priority;
      image.src = book.pages[index].src;
    };
    const loadAround = (index: number) => {
      // index ^ 1 is the other page of index's two-page spread
      request(index, "high");
      request(index ^ 1, "high");
      const end = Math.min(last, index + LOOKAHEAD);
      for (let i = Math.max(0, index - 2); i <= end; i++) request(i, "auto");
    };
    loadAround(0);

    let flip: PageFlip | null = null;
    let cancelled = false;
    // the page the background downloads work outwards from
    let focus = 0;
    let state = "read";
    let onIdle: (() => void)[] = [];
    let jumps = 0;

    const nearestMissing = () => {
      for (let d = 0; d <= last; d++) {
        for (const i of [focus + d, focus - d]) {
          if (i >= 0 && i <= last && !images[i].getAttribute("src")) return i;
        }
      }
      return -1;
    };
    const downloadRest = async () => {
      for (let i = nearestMissing(); i !== -1 && !cancelled; i = nearestMissing()) {
        request(i, "low");
        await settled(images[i]);
      }
    };

    const goTo = async (target: number) => {
      const page = Math.min(last, Math.max(0, target));
      const jump = ++jumps;
      focus = page;
      loadAround(page);
      // flip onto pages that can paint, not onto blank white ones
      await decoded([page, page ^ 1].filter((i) => i <= last).map((i) => images[i]), JUMP_WAIT_MS);
      // page-flip completes a running turn on top of a new one, which would land on the wrong spread
      if (state === "flipping" || state === "user_fold") {
        await new Promise<void>((resolve) => onIdle.push(resolve));
      }
      if (!cancelled && jump === jumps) flip?.flip(page);
    };

    import("page-flip").then(async ({ PageFlip }) => {
      if (cancelled) return;
      flip = new PageFlip(root, {
        width: book.width,
        height: book.height,
        size: "stretch",
        minWidth: MIN_PAGE_WIDTH,
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
        focus = index;
        setCurrentPage(index);
        loadAround(index);
      });
      flip.on("changeOrientation", (e) => setOrientation(e.data === "portrait" ? "portrait" : "landscape"));
      flip.on("changeState", (e) => {
        state = String(e.data);
        if (state !== "read") return;
        onIdle.forEach((resolve) => resolve());
        onIdle = [];
      });
      flip.loadFromHTML(built.map((b) => b.element));
      flipRef.current = flip;
      goToRef.current = goTo;
      setCurrentPage(flip.getCurrentPageIndex());
      setOrientation(flip.getOrientation());

      // the plain-image opening spread stays on screen until page-flip's copies of it can paint
      await decoded(images.slice(0, 2), 2000);
      if (cancelled) return;
      setReadyKey(book.key);
      if (!prefersSavingData()) {
        for (let i = 0; i < BACKGROUND_DOWNLOADS; i++) void downloadRest();
      }
    });

    return () => {
      cancelled = true;
      flipRef.current = null;
      goToRef.current = null;
      if (flip) flip.destroy();
      else root.remove();
    };
  }, [book]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") flipRef.current?.flipPrev();
      else if (e.key === "ArrowRight") flipRef.current?.flipNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function commitDraft() {
    if (draft === null) return;
    const page = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(page)) void goToRef.current?.(page - 1);
  }

  const ready = book !== null && readyKey === book.key;
  const total = book?.pages.length ?? 0;
  // in landscape page-flip shows currentPage and the one after it side by side
  const lastShown = ready && orientation === "landscape" ? Math.min(currentPage + 1, total - 1) : currentPage;
  const atStart = !ready || currentPage === 0;
  const atEnd = !ready || lastShown >= total - 1;

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

      {!notice && !book && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-6 w-6 animate-spin rounded-full border border-gold/30 border-t-gold" />
          <p className="font-ui text-[10px] uppercase tracking-[0.25em] text-white/40">
            {renderProgress.total > 0
              ? `Rendering page ${renderProgress.done} / ${renderProgress.total}`
              : "Loading catalogue"}
          </p>
        </div>
      )}

      <div className="relative w-full">
        {!notice && book && !ready && <OpeningSpread book={book} />}
        {/* never display:none: page-flip measures this box's width when it initializes */}
        <div
          ref={hostRef}
          className={ready ? "w-full" : "invisible absolute inset-x-0 top-0"}
          aria-label="Catalogue"
        />
      </div>

      {!notice && book && (
        <nav
          aria-label="Catalogue pages"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 font-ui text-[10px] uppercase tracking-[0.25em] text-white/50 sm:gap-x-7"
        >
          <NavButton label="First page" disabled={atStart} onClick={() => void goToRef.current?.(0)}>
            &laquo;
          </NavButton>
          <NavButton label="Previous page" disabled={atStart} onClick={() => flipRef.current?.flipPrev()}>
            &larr; Prev
          </NavButton>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // committing happens on blur, which also closes the keyboard on phones
              pageInputRef.current?.blur();
            }}
            className="flex items-center gap-2"
          >
            <label htmlFor="catalogue-page">Page</label>
            <input
              ref={pageInputRef}
              id="catalogue-page"
              type="text"
              inputMode="numeric"
              enterKeyHint="go"
              autoComplete="off"
              title={`Type a page number from 1 to ${total}`}
              disabled={!ready}
              value={draft ?? String(currentPage + 1)}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commitDraft}
              className="w-11 border border-white/15 bg-transparent py-1 text-center text-[11px] tracking-normal text-white transition-colors hover:border-white/30 focus:border-gold/60 focus:outline-none disabled:opacity-50"
            />
            {lastShown > currentPage && <span>&ndash; {lastShown + 1}</span>}
            <span>/ {total}</span>
          </form>
          <NavButton label="Next page" disabled={atEnd} onClick={() => flipRef.current?.flipNext()}>
            Next &rarr;
          </NavButton>
          <NavButton label="Last page" disabled={atEnd} onClick={() => void goToRef.current?.(total - 1)}>
            &raquo;
          </NavButton>
        </nav>
      )}

      <CatalogueAdmin
        storeConfigured={storeConfigured}
        imageStoreConfigured={imageStoreConfigured}
        onPublished={setCatalogue}
      />
    </div>
  );
}
