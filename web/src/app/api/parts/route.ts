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

// GET /api/parts?q=&store_id= — public storefront search.
// Price is the per-store price when a store is chosen
// (COALESCE(store_price.price, part.default_price)); stock is that store's
// inventory quantity. Discontinued parts are excluded.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const storeId = parseId(searchParams.get("store_id"));

  try {
    const result = await pool.query(
      `SELECT p.part_id, p.part_number, p.name, p.condition,
              p.default_price, p.warranty_months,
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
        WHERE NOT p.discontinued
          AND ($1 = '' OR p.name ILIKE '%' || $1 || '%'
               OR p.part_number ILIKE '%' || $1 || '%')
        ORDER BY p.name
        LIMIT 200`,
      [q, storeId]
    );
    return NextResponse.json({ parts: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list parts");
  }
}

// POST /api/parts — create a part (employees only).
// Body: { part_number, name, category_id, manufacturer_id, condition,
//         default_price, warranty_months? }
export async function POST(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, [
    "part_number",
    "name",
    "category_id",
    "manufacturer_id",
    "condition",
    "default_price",
  ]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }
  if (body.condition !== "new" && body.condition !== "rebuilt") {
    return jsonError("condition must be 'new' or 'rebuilt'", 400);
  }
  const defaultPrice = Number(body.default_price);
  if (!Number.isFinite(defaultPrice) || defaultPrice <= 0) {
    return jsonError("default_price must be a positive number", 400);
  }
  const warrantyMonths =
    body.warranty_months === undefined ? 0 : Number(body.warranty_months);
  if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0) {
    return jsonError("warranty_months must be a non-negative integer", 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO part
         (part_number, name, category_id, manufacturer_id, condition,
          default_price, warranty_months)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        String(body.part_number).trim(),
        String(body.name).trim(),
        Number(body.category_id),
        Number(body.manufacturer_id),
        body.condition,
        defaultPrice,
        warrantyMonths,
      ]
    );
    return NextResponse.json({ part: result.rows[0] }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err, "create part", 400);
  }
}
