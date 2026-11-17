import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "./auth";
import type { AuthPayload } from "./types";

// Small shared helpers so every CRUD route behaves the same way:
// JSON errors, auth checks, id parsing, partial-update building and
// PostgreSQL error mapping.

export function jsonError(
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Require any signed-in user (customer or employee). */
export async function requireUser(
  request: Request
): Promise<AuthPayload | NextResponse> {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return jsonError("Authentication required", 401);
  return user;
}

/** Require an employee token (any role). */
export async function requireEmployee(
  request: Request
): Promise<AuthPayload | NextResponse> {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return jsonError("Authentication required", 401);
  if (user.kind !== "employee") {
    return jsonError("Employee access required", 403);
  }
  return user;
}

/** Require an employee token with one of the given role names. */
export async function requireRole(
  request: Request,
  roles: string[]
): Promise<AuthPayload | NextResponse> {
  const user = await requireEmployee(request);
  if (user instanceof NextResponse) return user;
  if (!user.role || !roles.includes(user.role)) {
    return jsonError(
      `Requires one of these roles: ${roles.join(", ")}`,
      403
    );
  }
  return user;
}

/** Require a customer token (self-service routes). */
export async function requireCustomer(
  request: Request
): Promise<AuthPayload | NextResponse> {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return jsonError("Authentication required", 401);
  if (user.kind !== "customer") {
    return jsonError("Customer access required", 403);
  }
  return user;
}

/** Parse a positive integer route/query id, or null when invalid. */
export function parseId(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Build a parameterized SET clause for a partial update from the fields
 * actually present in the body. Column names come only from the allow-list
 * passed by the route, never from the request body.
 */
export function collectUpdates(
  body: Record<string, unknown>,
  allowed: string[]
): { setSql: string; values: unknown[] } | null {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of allowed) {
    if (body[field] !== undefined) {
      values.push(body[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }
  if (sets.length === 0) return null;
  return { setSql: sets.join(", "), values };
}

/** Names of required fields that are missing/empty in the body. */
export function missingFields(
  body: Record<string, unknown>,
  fields: string[]
): string[] {
  return fields.filter((field) => {
    const value = body[field];
    return (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    );
  });
}

/**
 * Map PostgreSQL errors to sensible JSON responses:
 * 23505 unique violation -> 409, 23503 foreign key -> fkStatus
 * (400 when a referenced row does not exist, 409 when a delete is blocked),
 * 23514 check violation -> 400, 22P02 invalid input syntax -> 400.
 */
export function dbErrorResponse(
  err: unknown,
  context: string,
  fkStatus: 400 | 409 = 409
): NextResponse {
  const code = (err as { code?: string })?.code;
  if (code === "23505") {
    return jsonError(
      "A record with the same unique value already exists",
      409
    );
  }
  if (code === "23503") {
    return jsonError(
      fkStatus === 400
        ? "A referenced record does not exist"
        : "This record is referenced by other records and cannot be removed",
      fkStatus
    );
  }
  if (code === "23514") {
    return jsonError("A value violates a database constraint", 400);
  }
  if (code === "22P02") {
    return jsonError("Invalid value format", 400);
  }
  console.error(`${context} failed:`, err);
  return jsonError("Internal server error", 500);
}

/** Read a JSON body, returning null when it is not valid JSON. */
export async function readJson(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object") return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
