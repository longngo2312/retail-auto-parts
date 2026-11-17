import { NextRequest, NextResponse } from "next/server";

// Middleware runs on the Edge runtime, where the `jsonwebtoken` package
// cannot run. Tokens are HS256, so we verify the HMAC signature directly
// with Web Crypto and check the payload claims. Full verification for API
// routes happens in src/lib/auth.ts with jsonwebtoken.

interface TokenClaims {
  sub: number | string;
  kind?: string;
  username?: string;
  role?: string;
  exp?: number;
}

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyHs256(token: string): Promise<TokenClaims | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureB64) as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadB64))
    ) as TokenClaims;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The staff login page itself must stay reachable.
  if (pathname === "/staff/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const claims = token ? await verifyHs256(token) : null;

  if (pathname.startsWith("/staff")) {
    if (!claims || claims.kind !== "employee") {
      const url = request.nextUrl.clone();
      url.pathname = "/staff/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
    if (!claims) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/staff/:path*"],
};
