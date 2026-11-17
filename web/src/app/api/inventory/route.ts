import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  missingFields,
  readJson,
  dbErrorResponse,
  parseId,
} from "@/lib/api";

// Inventory rows are keyed by (part_id, store_id). All routes here are
// staff-only. NOTE: this basic upsert writes the row directly; the
// audited adjustment flow (inventory_audit entries, req 7/31) is core
// logic — see BACKEND_TODO.md.

// GET /api/inventory?store_id=&part_id= — list inventory rows.
export async function GET(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const storeId = parseId(searchParams.get("store_id"));
  const partId = parseId(searchParams.get("part_id"));
  if (searchParams.get("store_id") && storeId === null) {
    return jsonError("Invalid store_id", 400);
  }
  if (searchParams.get("part_id") && partId === null) {
    return jsonError("Invalid part_id", 400);
  }

  try {
    const result = await pool.query(
      `SELECT i.part_id, i.store_id, i.quantity, i.reorder_threshold,
              p.part_number, p.name AS part_name, s.name AS store_name
         FROM inventory i
         JOIN part p ON p.part_id = i.part_id
         JOIN store s ON s.store_id = i.store_id
        WHERE ($1::int IS NULL OR i.store_id = $1)
          AND ($2::int IS NULL OR i.part_id = $2)
        ORDER BY s.name, p.name
        LIMIT 500`,
      [storeId, partId]
    );
    return NextResponse.json({ inventory: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list inventory");
  }
}

// POST/PUT /api/inventory — upsert on (part_id, store_id).
// Body: { part_id, store_id, quantity, reorder_threshold? }
async function upsertInventory(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, ["part_id", "store_id", "quantity"]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }
  const quantity = Number(body.quantity);
  const reorderThreshold =
    body.reorder_threshold === undefined ? 0 : Number(body.reorder_threshold);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return jsonError("quantity must be a non-negative integer", 400);
  }
  if (!Number.isInteger(reorderThreshold) || reorderThreshold < 0) {
    return jsonError(
      "reorder_threshold must be a non-negative integer",
      400
    );
  }

  try {
    const result = await pool.query(
      `INSERT INTO inventory (part_id, store_id, quantity, reorder_threshold)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (part_id, store_id) DO UPDATE
         SET quantity = EXCLUDED.quantity,
             reorder_threshold = EXCLUDED.reorder_threshold
       RETURNING *`,
      [Number(body.part_id), Number(body.store_id), quantity, reorderThreshold]
    );
    return NextResponse.json({ inventory: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "upsert inventory", 400);
  }
}

export const POST = upsertInventory;
export const PUT = upsertInventory;

// DELETE /api/inventory?part_id=&store_id= — remove the row.
export async function DELETE(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const partId = parseId(searchParams.get("part_id"));
  const storeId = parseId(searchParams.get("store_id"));
  if (partId === null || storeId === null) {
    return jsonError("part_id and store_id query parameters are required", 400);
  }

  try {
    const result = await pool.query(
      `DELETE FROM inventory
        WHERE part_id = $1 AND store_id = $2
        RETURNING part_id`,
      [partId, storeId]
    );
    if (result.rows.length === 0) {
      return jsonError("Inventory row not found", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    // inventory_audit has a FK to (part_id, store_id) in inventory.
    return dbErrorResponse(err, "delete inventory", 409);
  }
}
