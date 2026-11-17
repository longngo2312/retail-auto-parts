import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  missingFields,
  readJson,
  dbErrorResponse,
} from "@/lib/api";

// GET /api/manufacturers — public list.
export async function GET() {
  try {
    const result = await pool.query(
      "SELECT manufacturer_id, name FROM manufacturer ORDER BY name"
    );
    return NextResponse.json({ manufacturers: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list manufacturers");
  }
}

// POST /api/manufacturers — create (employees only). Body: { name }
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
      "INSERT INTO manufacturer (name) VALUES ($1) RETURNING *",
      [String(body.name).trim()]
    );
    return NextResponse.json(
      { manufacturer: result.rows[0] },
      { status: 201 }
    );
  } catch (err) {
    return dbErrorResponse(err, "create manufacturer");
  }
}
