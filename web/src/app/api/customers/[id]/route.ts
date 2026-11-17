import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  dbErrorResponse,
  parseId,
} from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/customers/[id] — staff customer detail (employees only).
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid customer id", 400);

  try {
    const result = await pool.query(
      `SELECT customer_id, username, first_name, last_name, email, phone,
              address, preferred_store_id, created_at
         FROM customer
        WHERE customer_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Customer not found", 404);
    }
    return NextResponse.json({ customer: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "get customer");
  }
}
