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

// GET /api/parts/[id]?store_id= — public part detail, including the
// vehicles the part fits (part_fitment -> vehicle).
export async function GET(request: NextRequest, context: RouteContext) {
  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid part id", 400);

  const storeId = parseId(new URL(request.url).searchParams.get("store_id"));

  try {
    const result = await pool.query(
      `SELECT p.part_id, p.part_number, p.name, p.condition,
              p.default_price, p.warranty_months, p.discontinued,
              p.category_id, p.manufacturer_id,
              c.name AS category, m.name AS manufacturer,
              COALESCE(sp.price, p.default_price) AS price,
              i.quantity AS stock
         FROM part p
         JOIN category c ON c.category_id = p.category_id
         JOIN manufacturer m ON m.manufacturer_id = p.manufacturer_id
         LEFT JOIN store_price sp
           ON sp.part_id = p.part_id AND sp.store_id = $2
         LEFT JOIN inventory i
           ON i.part_id = p.part_id AND i.store_id = $2
        WHERE p.part_id = $1`,
      [id, storeId]
    );
    if (result.rows.length === 0) {
      return jsonError("Part not found", 404);
    }

    const fitment = await pool.query(
      `SELECT v.vehicle_id, v.year, v.make, v.model, v.engine
         FROM part_fitment pf
         JOIN vehicle v ON v.vehicle_id = pf.vehicle_id
        WHERE pf.part_id = $1
        ORDER BY v.year DESC, v.make, v.model`,
      [id]
    );

    return NextResponse.json({
      part: result.rows[0],
      fits_vehicles: fitment.rows,
    });
  } catch (err) {
    return dbErrorResponse(err, "get part");
  }
}

// PUT/PATCH /api/parts/[id] — partial update (employees only).
async function updatePart(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid part id", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  if (
    body.condition !== undefined &&
    body.condition !== "new" &&
    body.condition !== "rebuilt"
  ) {
    return jsonError("condition must be 'new' or 'rebuilt'", 400);
  }

  const updates = collectUpdates(body, [
    "part_number",
    "name",
    "category_id",
    "manufacturer_id",
    "condition",
    "default_price",
    "warranty_months",
    "discontinued",
  ]);
  if (!updates) return jsonError("No updatable fields provided", 400);

  try {
    const result = await pool.query(
      `UPDATE part SET ${updates.setSql}
        WHERE part_id = $${updates.values.length + 1}
        RETURNING *`,
      [...updates.values, id]
    );
    if (result.rows.length === 0) {
      return jsonError("Part not found", 404);
    }
    return NextResponse.json({ part: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "update part", 400);
  }
}

export const PUT = updatePart;
export const PATCH = updatePart;

// DELETE /api/parts/[id] — SOFT delete: sets discontinued = true.
// Parts are never hard-deleted (past order lines reference them).
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid part id", 400);

  try {
    const result = await pool.query(
      `UPDATE part SET discontinued = true
        WHERE part_id = $1
        RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Part not found", 404);
    }
    return NextResponse.json({ part: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "delete part");
  }
}
