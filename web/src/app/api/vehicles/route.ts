import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  missingFields,
  readJson,
  dbErrorResponse,
} from "@/lib/api";

// GET /api/vehicles?make=&model=&year= — public vehicle catalog search.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const make = (searchParams.get("make") ?? "").trim();
  const model = (searchParams.get("model") ?? "").trim();
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  if (yearRaw && !Number.isInteger(year)) {
    return jsonError("year must be an integer", 400);
  }

  try {
    const result = await pool.query(
      `SELECT vehicle_id, year, make, model, engine
         FROM vehicle
        WHERE ($1 = '' OR make ILIKE '%' || $1 || '%')
          AND ($2 = '' OR model ILIKE '%' || $2 || '%')
          AND ($3::int IS NULL OR year = $3)
        ORDER BY year DESC, make, model
        LIMIT 200`,
      [make, model, year]
    );
    return NextResponse.json({ vehicles: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list vehicles");
  }
}

// POST /api/vehicles — add a catalog vehicle (employees only).
// Body: { year, make, model, engine } — the combination is UNIQUE;
// duplicates return 409.
export async function POST(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, ["year", "make", "model", "engine"]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }
  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return jsonError("year must be between 1900 and 2100", 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO vehicle (year, make, model, engine)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        year,
        String(body.make).trim(),
        String(body.model).trim(),
        String(body.engine).trim(),
      ]
    );
    return NextResponse.json({ vehicle: result.rows[0] }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err, "create vehicle");
  }
}
