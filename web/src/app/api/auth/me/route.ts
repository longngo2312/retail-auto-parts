import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/auth";
import type { CustomerUser, EmployeeUser } from "@/types";

// GET /api/auth/me — return the currently signed-in user (never the
// password hash), or 401 when there is no valid token.
export async function GET(request: NextRequest) {
  const payload = await getCurrentUserFromRequest(request);
  if (!payload) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    if (payload.kind === "customer") {
      const result = await pool.query(
        `SELECT customer_id, username, first_name, last_name, email, phone,
                address, preferred_store_id
           FROM customer
          WHERE customer_id = $1`,
        [payload.sub]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const user: CustomerUser = { kind: "customer", ...result.rows[0] };
      return NextResponse.json({ user });
    }

    const result = await pool.query(
      `SELECT e.employee_id, e.username, e.first_name, e.last_name,
              e.store_id, e.active, r.name AS role
         FROM employee e
         JOIN role r ON r.role_id = e.role_id
        WHERE e.employee_id = $1`,
      [payload.sub]
    );
    if (result.rows.length === 0 || !result.rows[0].active) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const user: EmployeeUser = { kind: "employee", ...result.rows[0] };
    return NextResponse.json({ user });
  } catch (err) {
    console.error("me failed:", err);
    return NextResponse.json(
      { error: "Could not load the current user" },
      { status: 500 }
    );
  }
}
