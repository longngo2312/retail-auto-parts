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

// Per-store price overrides, keyed by (part_id, store_id). Staff-only.
// When no store_price row exists, part.default_price applies (see
// /api/parts, which COALESCEs the two).

// GET /api/store-prices?store_id=&part_id= — list price rows.
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
      `SELECT sp.part_id, sp.store_id, sp.price,
              p.part_number, p.name AS part_name, s.name AS store_name
         FROM store_price sp
         JOIN part p ON p.part_id = sp.part_id
         JOIN store s ON s.store_id = sp.store_id
        WHERE ($1::int IS NULL OR sp.store_id = $1)
          AND ($2::int IS NULL OR sp.part_id = $2)
        ORDER BY s.name, p.name
        LIMIT 500`,
      [storeId, partId]
    );
    return NextResponse.json({ store_prices: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list store prices");
  }
}

// POST/PUT /api/store-prices — upsert on (part_id, store_id).
// Body: { part_id, store_id, price }
async function upsertStorePrice(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, ["part_id", "store_id", "price"]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return jsonError("price must be a positive number", 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO store_price (part_id, store_id, price)
       VALUES ($1, $2, $3)
       ON CONFLICT (part_id, store_id) DO UPDATE
         SET price = EXCLUDED.price
       RETURNING *`,
      [Number(body.part_id), Number(body.store_id), price]
    );
    return NextResponse.json({ store_price: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "upsert store price", 400);
  }
}

export const POST = upsertStorePrice;
export const PUT = upsertStorePrice;

// DELETE /api/store-prices?part_id=&store_id= — remove the override
// (the part's default_price applies again afterwards).
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
      `DELETE FROM store_price
        WHERE part_id = $1 AND store_id = $2
        RETURNING part_id`,
      [partId, storeId]
    );
    if (result.rows.length === 0) {
      return jsonError("Store price row not found", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err, "delete store price");
  }
}
