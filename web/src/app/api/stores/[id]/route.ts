import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  collectUpdates,
  readJson,
  dbErrorResponse,
  parseId,
} from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/stores/[id] — public store detail.
export async function GET(_request: NextRequest, context: RouteContext) {
  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid store id", 400);

  try {
    const result = await pool.query(
      `SELECT store_id, name, address, phone, hours, tax_rate, active
         FROM store WHERE store_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Store not found", 404);
    }
    return NextResponse.json({ store: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "get store");
  }
}

// PUT/PATCH /api/stores/[id] — partial update (employees only).
async function updateStore(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid store id", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const updates = collectUpdates(body, [
    "name",
    "address",
    "phone",
    "hours",
    "tax_rate",
    "active",
  ]);
  if (!updates) return jsonError("No updatable fields provided", 400);

  try {
    const result = await pool.query(
      `UPDATE store SET ${updates.setSql}
        WHERE store_id = $${updates.values.length + 1}
        RETURNING *`,
      [...updates.values, id]
    );
    if (result.rows.length === 0) {
      return jsonError("Store not found", 404);
    }
    return NextResponse.json({ store: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "update store");
  }
}

export const PUT = updateStore;
export const PATCH = updateStore;

// DELETE /api/stores/[id] — SOFT delete: sets active = false.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid store id", 400);

  try {
    const result = await pool.query(
      `UPDATE store SET active = false
        WHERE store_id = $1
        RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Store not found", 404);
    }
    return NextResponse.json({ store: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "delete store");
  }
}
