// Shared by the API routes and the browser, so nothing here may import server-only modules.

/** A clickable hyperlink carried over from the PDF, positioned in % of the page box. */
export type CatalogueLink = {
  url: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

export type CataloguePage = {
  src: string;
  links: CatalogueLink[];
};

/** The catalogue pages pre-rendered to images at publish time, so visitors never download or render the PDF. */
export type CatalogueRendition = {
  version: string;
  width: number;
  height: number;
  pages: CataloguePage[];
};

export type CatalogueState = {
  driveFileId: string;
  updatedAt: string;
  /** Missing for catalogues published before pre-rendering existed, or when no image storage is configured. */
  rendition?: CatalogueRendition;
};

/** Header carrying the URI-encoded admin password (header values can't hold arbitrary Unicode). */
export const PASSWORD_HEADER = "x-catalogue-password";

/** Exposes the PDF's byte size without a Content-Length header, which would make Vercel buffer the stream. */
export const PDF_SIZE_HEADER = "x-pdf-size";

export const VERSION_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;

export function isSafeLinkUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(url);
}
