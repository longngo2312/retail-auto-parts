import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireEmployee, dbErrorResponse } from "@/lib/api";

// GET /api/customers — staff list of customers (employees only).
// password_hash is never selected, here or anywhere else.
export async function GET(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await pool.query(
      `SELECT customer_id, username, first_name, last_name, email, phone,
              address, preferred_store_id, created_at
         FROM customer
        ORDER BY last_name, first_name
        LIMIT 500`
    );
    return NextResponse.json({ customers: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list customers");
  }
}
