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

// GET /api/manufacturers/[id] — public detail.
export async function GET(_request: NextRequest, context: RouteContext) {
  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid manufacturer id", 400);

  try {
    const result = await pool.query(
      "SELECT manufacturer_id, name FROM manufacturer WHERE manufacturer_id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Manufacturer not found", 404);
    }
    return NextResponse.json({ manufacturer: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "get manufacturer");
  }
}

// PUT/PATCH /api/manufacturers/[id] — rename (employees only).
async function updateManufacturer(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid manufacturer id", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const updates = collectUpdates(body, ["name"]);
  if (!updates) return jsonError("No updatable fields provided", 400);

  try {
    const result = await pool.query(
      `UPDATE manufacturer SET ${updates.setSql}
        WHERE manufacturer_id = $${updates.values.length + 1}
        RETURNING *`,
      [...updates.values, id]
    );
    if (result.rows.length === 0) {
      return jsonError("Manufacturer not found", 404);
    }
    return NextResponse.json({ manufacturer: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "update manufacturer");
  }
}

export const PUT = updateManufacturer;
export const PATCH = updateManufacturer;

// DELETE /api/manufacturers/[id] — hard delete (employees only).
// Returns 409 while any part references the manufacturer.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid manufacturer id", 400);

  try {
    const result = await pool.query(
      "DELETE FROM manufacturer WHERE manufacturer_id = $1 RETURNING manufacturer_id",
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Manufacturer not found", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err, "delete manufacturer", 409);
  }
}
