import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireCustomer,
  readJson,
  dbErrorResponse,
  parseId,
} from "@/lib/api";

// Vehicles owned by the signed-in customer (customer_vehicle joined to the
// shared vehicle catalog). All queries are scoped to the token's customer.

// GET /api/customers/me/vehicles — my vehicles.
export async function GET(request: NextRequest) {
  const auth = await requireCustomer(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await pool.query(
      `SELECT cv.customer_vehicle_id, cv.nickname,
              v.vehicle_id, v.year, v.make, v.model, v.engine
         FROM customer_vehicle cv
         JOIN vehicle v ON v.vehicle_id = cv.vehicle_id
        WHERE cv.customer_id = $1
        ORDER BY v.year DESC, v.make, v.model`,
      [auth.sub]
    );
    return NextResponse.json({ vehicles: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list my vehicles");
  }
}

// POST /api/customers/me/vehicles — add a vehicle to my account.
// Body: { vehicle_id, nickname? }
//    OR { year, make, model, engine, nickname? } — the catalog row is
//       found or created (vehicle is UNIQUE on year/make/model/engine).
export async function POST(request: NextRequest) {
  const auth = await requireCustomer(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const nickname = body.nickname ? String(body.nickname).trim() : null;

  try {
    let vehicleId: number | null = null;

    if (body.vehicle_id !== undefined && body.vehicle_id !== null) {
      vehicleId = parseId(String(body.vehicle_id));
      if (vehicleId === null) return jsonError("Invalid vehicle_id", 400);
    } else {
      const year = Number(body.year);
      const make = String(body.make ?? "").trim();
      const model = String(body.model ?? "").trim();
      const engine = String(body.engine ?? "").trim();
      if (!Number.isInteger(year) || !make || !model || !engine) {
        return jsonError(
          "Provide vehicle_id, or year, make, model and engine",
          400
        );
      }
      // Find-or-create the shared catalog row.
      const vehicle = await pool.query(
        `INSERT INTO vehicle (year, make, model, engine)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (year, make, model, engine)
           DO UPDATE SET year = EXCLUDED.year
         RETURNING vehicle_id`,
        [year, make, model, engine]
      );
      vehicleId = vehicle.rows[0].vehicle_id;
    }

    const result = await pool.query(
      `INSERT INTO customer_vehicle (customer_id, vehicle_id, nickname)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [auth.sub, vehicleId, nickname]
    );
    return NextResponse.json(
      { customer_vehicle: result.rows[0] },
      { status: 201 }
    );
  } catch (err) {
    // 23505: (customer_id, vehicle_id) already linked -> 409.
    // 23503: vehicle_id does not exist -> 400.
    return dbErrorResponse(err, "add my vehicle", 400);
  }
}

// DELETE /api/customers/me/vehicles?customer_vehicle_id= — remove one of
// my vehicles (only rows belonging to the signed-in customer).
export async function DELETE(request: NextRequest) {
  const auth = await requireCustomer(request);
  if (auth instanceof NextResponse) return auth;

  const customerVehicleId = parseId(
    new URL(request.url).searchParams.get("customer_vehicle_id")
  );
  if (customerVehicleId === null) {
    return jsonError("customer_vehicle_id query parameter is required", 400);
  }

  try {
    const result = await pool.query(
      `DELETE FROM customer_vehicle
        WHERE customer_vehicle_id = $1 AND customer_id = $2
        RETURNING customer_vehicle_id`,
      [customerVehicleId, auth.sub]
    );
    if (result.rows.length === 0) {
      return jsonError("Vehicle not found on your account", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err, "remove my vehicle");
  }
}
