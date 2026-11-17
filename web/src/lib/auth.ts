import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { AuthPayload } from "@/types";

export const COOKIE_NAME = "token";
const TOKEN_TTL = "7d";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

// ---------- password hashing (bcrypt, cost 10) ----------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------- JWT ----------

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    return {
      sub: Number(decoded.sub),
      kind: decoded.kind as AuthPayload["kind"],
      username: decoded.username as string,
      role: decoded.role as string | undefined,
    };
  } catch {
    return null;
  }
}

// ---------- current user ----------

/**
 * Read the current user from the httpOnly `token` cookie (server components
 * and route handlers). Returns null when there is no valid token.
 */
export async function getCurrentUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Same as getCurrentUser, but reads the token from an Authorization:
 * Bearer <token> header first, falling back to the cookie. For route
 * handlers that receive the Request object.
 */
export async function getCurrentUserFromRequest(
  request: Request
): Promise<AuthPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyToken(authHeader.slice("Bearer ".length));
    if (payload) return payload;
  }
  return getCurrentUser();
}

// ---------- cookie options ----------

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // 7 days, matching the token TTL
  maxAge: 60 * 60 * 24 * 7,
  secure: process.env.NODE_ENV === "production",
};
