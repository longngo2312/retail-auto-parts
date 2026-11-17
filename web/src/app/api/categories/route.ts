import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  missingFields,
  readJson,
  dbErrorResponse,
} from "@/lib/api";

// GET /api/categories — public list (flat, with parent_id for the hierarchy).
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT category_id, parent_id, name
         FROM category
        ORDER BY parent_id NULLS FIRST, name`
    );
    return NextResponse.json({ categories: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list categories");
  }
}

// POST /api/categories — create a category (employees only).
// Body: { name, parent_id? }
// The (parent_id, name) pair is UNIQUE NULLS NOT DISTINCT in the schema;
// duplicates surface as 409.
export async function POST(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, ["name"]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }
  const parentId =
    body.parent_id === undefined || body.parent_id === null
      ? null
      : Number(body.parent_id);
  if (parentId !== null && !Number.isInteger(parentId)) {
    return jsonError("parent_id must be a category id or null", 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO category (parent_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [parentId, String(body.name).trim()]
    );
    return NextResponse.json(
      { category: result.rows[0] },
      { status: 201 }
    );
  } catch (err) {
    return dbErrorResponse(err, "create category", 400);
  }
}
