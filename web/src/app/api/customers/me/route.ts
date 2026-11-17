import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireCustomer,
  collectUpdates,
  readJson,
  dbErrorResponse,
} from "@/lib/api";
import type { CustomerUser } from "@/lib/types";

// Self-service profile for the signed-in customer.
// Password changes are deliberately NOT handled here (see BACKEND_TODO.md).

// GET /api/customers/me — my profile.
export async function GET(request: NextRequest) {
  const auth = await requireCustomer(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await pool.query(
      `SELECT customer_id, username, first_name, last_name, email, phone,
              address, preferred_store_id, created_at
         FROM customer
        WHERE customer_id = $1`,
      [auth.sub]
    );
    if (result.rows.length === 0) {
      return jsonError("Customer not found", 404);
    }
    const user: CustomerUser = { kind: "customer", ...result.rows[0] };
    return NextResponse.json({ user });
  } catch (err) {
    return dbErrorResponse(err, "get my profile");
  }
}

// PUT/PATCH /api/customers/me — update my profile.
// Allowed: first_name, last_name, email, phone, address, preferred_store_id.
async function updateMe(request: NextRequest) {
  const auth = await requireCustomer(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  if (
    body.preferred_store_id !== undefined &&
    body.preferred_store_id !== null &&
    !Number.isInteger(Number(body.preferred_store_id))
  ) {
    return jsonError("preferred_store_id must be a store id or null", 400);
  }

  const updates = collectUpdates(body, [
    "first_name",
    "last_name",
    "email",
    "phone",
    "address",
    "preferred_store_id",
  ]);
  if (!updates) return jsonError("No updatable fields provided", 400);

  try {
    const result = await pool.query(
      `UPDATE customer SET ${updates.setSql}
        WHERE customer_id = $${updates.values.length + 1}
        RETURNING customer_id, username, first_name, last_name, email,
                  phone, address, preferred_store_id, created_at`,
      [...updates.values, auth.sub]
    );
    if (result.rows.length === 0) {
      return jsonError("Customer not found", 404);
    }
    const user: CustomerUser = { kind: "customer", ...result.rows[0] };
    return NextResponse.json({ user });
  } catch (err) {
    // email is UNIQUE -> 409; preferred_store_id FK -> 400.
    return dbErrorResponse(err, "update my profile", 400);
  }
}

export const PUT = updateMe;
export const PATCH = updateMe;
