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

// GET /api/vehicles/[id] — public detail.
export async function GET(_request: NextRequest, context: RouteContext) {
  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid vehicle id", 400);

  try {
    const result = await pool.query(
      "SELECT * FROM vehicle WHERE vehicle_id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Vehicle not found", 404);
    }
    return NextResponse.json({ vehicle: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "get vehicle");
  }
}

// PUT/PATCH /api/vehicles/[id] — partial update (employees only).
async function updateVehicle(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid vehicle id", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const updates = collectUpdates(body, ["year", "make", "model", "engine"]);
  if (!updates) return jsonError("No updatable fields provided", 400);

  try {
    const result = await pool.query(
      `UPDATE vehicle SET ${updates.setSql}
        WHERE vehicle_id = $${updates.values.length + 1}
        RETURNING *`,
      [...updates.values, id]
    );
    if (result.rows.length === 0) {
      return jsonError("Vehicle not found", 404);
    }
    return NextResponse.json({ vehicle: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "update vehicle");
  }
}

export const PUT = updateVehicle;
export const PATCH = updateVehicle;

// DELETE /api/vehicles/[id] — guarded hard delete (employees only).
// Vehicle is a shared catalog table with no soft-delete flag, so deletion
// is refused with 409 while customer_vehicle or part_fitment rows
// reference the vehicle.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid vehicle id", 400);

  try {
    const refs = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM customer_vehicle WHERE vehicle_id = $1) +
         (SELECT COUNT(*) FROM part_fitment WHERE vehicle_id = $1)
         AS ref_count`,
      [id]
    );
    if (Number(refs.rows[0].ref_count) > 0) {
      return jsonError(
        "Vehicle is referenced by customer vehicles or part fitments and cannot be deleted",
        409
      );
    }
    const result = await pool.query(
      "DELETE FROM vehicle WHERE vehicle_id = $1 RETURNING vehicle_id",
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Vehicle not found", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err, "delete vehicle", 409);
  }
}
