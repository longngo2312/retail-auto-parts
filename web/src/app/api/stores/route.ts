import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  missingFields,
  readJson,
  dbErrorResponse,
} from "@/lib/api";

// GET /api/stores — public list of active stores.
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT store_id, name, address, phone, hours, tax_rate
         FROM store
        WHERE active
        ORDER BY name`
    );
    return NextResponse.json({ stores: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list stores");
  }
}

// POST /api/stores — create a store (employees only).
// Body: { name, address, phone, hours, tax_rate? }
export async function POST(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, ["name", "address", "phone", "hours"]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }
  const taxRate = body.tax_rate === undefined ? 0 : Number(body.tax_rate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate >= 1) {
    return jsonError("tax_rate must be a number in [0, 1)", 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO store (name, address, phone, hours, tax_rate)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        String(body.name).trim(),
        String(body.address).trim(),
        String(body.phone).trim(),
        String(body.hours).trim(),
        taxRate,
      ]
    );
    return NextResponse.json({ store: result.rows[0] }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err, "create store");
  }
}
