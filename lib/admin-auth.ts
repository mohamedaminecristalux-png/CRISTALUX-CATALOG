import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PASSWORD_HEADER } from "./catalogue-types";

function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Unlike a .env file, the Vercel dashboard stores a value verbatim, so a pasted
 * `"secret"` keeps its quotes and a copied line can carry a trailing newline.
 */
function configuredPassword(): string {
  const raw = (process.env.CATALOGUE_ADMIN_PASSWORD ?? "").trim();
  const quoted = raw.length >= 2 && (raw[0] === '"' || raw[0] === "'") && raw.at(-1) === raw[0];
  return quoted ? raw.slice(1, -1).trim() : raw;
}

/** Returns the error response to send back if `password` isn't the admin password, otherwise null. */
export function rejectUnlessAdmin(password: string | null | undefined): NextResponse | null {
  const adminPassword = configuredPassword();
  if (!adminPassword) {
    return NextResponse.json(
      { error: "The catalogue admin password isn't configured on the server yet." },
      { status: 500 }
    );
  }
  if (!password || !passwordMatches(password.trim(), adminPassword)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  return null;
}

export function passwordFromHeader(request: Request): string | null {
  const raw = request.headers.get(PASSWORD_HEADER);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
