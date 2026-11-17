import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  missingFields,
  readJson,
  dbErrorResponse,
} from "@/lib/api";

// Suppliers are staff data, not storefront catalog: all routes here
// require an employee token.

// GET /api/suppliers?include_inactive=1 — list suppliers.
export async function GET(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const includeInactive =
    new URL(request.url).searchParams.get("include_inactive") === "1";

  try {
    const result = await pool.query(
      `SELECT supplier_id, name, phone, email, address, active
         FROM supplier
        WHERE ($1 OR active)
        ORDER BY name`,
      [includeInactive]
    );
    return NextResponse.json({ suppliers: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list suppliers");
  }
}

// POST /api/suppliers — create (employees only).
// Body: { name, phone?, email?, address? }
export async function POST(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, ["name"]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO supplier (name, phone, email, address)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        String(body.name).trim(),
        body.phone ? String(body.phone).trim() : null,
        body.email ? String(body.email).trim() : null,
        body.address ? String(body.address).trim() : null,
      ]
    );
    return NextResponse.json({ supplier: result.rows[0] }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err, "create supplier");
  }
}
