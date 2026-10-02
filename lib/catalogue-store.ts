import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogueState } from "./catalogue-types";

export type { CatalogueState };

const CATALOGUE_KEY = "cristalux:catalogue";
const LOCAL_FILE = path.join(process.cwd(), ".data", "catalogue.json");

/**
 * Same names `Redis.fromEnv()` accepts: Upstash's own, or the `KV_*` ones the
 * Vercel Marketplace integration injects by default (inherited from Vercel KV).
 */
function hasRedis(): boolean {
  const env = process.env;
  return Boolean(
    (env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL) &&
      (env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN)
  );
}

/**
 * Vercel's production filesystem is read-only and ephemeral (a fresh copy per
 * invocation), so a local JSON file can never work as real shared storage
 * there. It's only used as a zero-setup fallback for `next dev`, so the
 * catalogue can be tested without provisioning a database first.
 */
function canUseLocalFile(): boolean {
  return !process.env.VERCEL;
}

export function isStoreConfigured(): boolean {
  return hasRedis() || canUseLocalFile();
}

async function getFromFile(): Promise<CatalogueState | null> {
  try {
    const raw = await readFile(LOCAL_FILE, "utf8");
    return JSON.parse(raw) as CatalogueState;
  } catch {
    return null;
  }
}

async function setToFile(state: CatalogueState): Promise<void> {
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function getCatalogue(): Promise<CatalogueState | null> {
  if (hasRedis()) {
    const value = await Redis.fromEnv().get<CatalogueState>(CATALOGUE_KEY);
    return value ?? null;
  }
  if (canUseLocalFile()) {
    return getFromFile();
  }
  return null;
}

export async function setCatalogue(state: CatalogueState): Promise<void> {
  if (hasRedis()) {
    await Redis.fromEnv().set(CATALOGUE_KEY, state);
    return;
  }
  if (canUseLocalFile()) {
    await setToFile(state);
    return;
  }
  throw new Error("Storage is not configured");
}
