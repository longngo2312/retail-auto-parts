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

// GET /api/suppliers/[id] — detail (employees only).
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid supplier id", 400);

  try {
    const result = await pool.query(
      "SELECT * FROM supplier WHERE supplier_id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Supplier not found", 404);
    }
    return NextResponse.json({ supplier: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "get supplier");
  }
}

// PUT/PATCH /api/suppliers/[id] — partial update (employees only).
async function updateSupplier(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid supplier id", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const updates = collectUpdates(body, [
    "name",
    "phone",
    "email",
    "address",
    "active",
  ]);
  if (!updates) return jsonError("No updatable fields provided", 400);

  try {
    const result = await pool.query(
      `UPDATE supplier SET ${updates.setSql}
        WHERE supplier_id = $${updates.values.length + 1}
        RETURNING *`,
      [...updates.values, id]
    );
    if (result.rows.length === 0) {
      return jsonError("Supplier not found", 404);
    }
    return NextResponse.json({ supplier: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "update supplier");
  }
}

export const PUT = updateSupplier;
export const PATCH = updateSupplier;

// DELETE /api/suppliers/[id] — SOFT delete: sets active = false.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid supplier id", 400);

  try {
    const result = await pool.query(
      `UPDATE supplier SET active = false
        WHERE supplier_id = $1
        RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Supplier not found", 404);
    }
    return NextResponse.json({ supplier: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "delete supplier");
  }
}
