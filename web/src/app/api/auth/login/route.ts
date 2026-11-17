import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  verifyPassword,
  signToken,
  COOKIE_NAME,
  authCookieOptions,
} from "@/lib/auth";
import type { CustomerUser, EmployeeUser } from "@/types";

// POST /api/auth/login
// Body: { username, password, kind?: "customer" | "employee" }
// Without `kind`, customers are checked first, then employees.
// Employees must have active = true. The role name comes from the role table.

const INVALID = { error: "Invalid username or password" };

async function findCustomer(username: string) {
  const result = await pool.query(
    `SELECT customer_id, username, password_hash, first_name, last_name,
            email, phone, address, preferred_store_id
       FROM customer
      WHERE username = $1`,
    [username]
  );
  return result.rows[0] as
    | (Omit<CustomerUser, "kind"> & { password_hash: string })
    | undefined;
}

async function findEmployee(username: string) {
  const result = await pool.query(
    `SELECT e.employee_id, e.username, e.password_hash, e.first_name,
            e.last_name, e.store_id, e.active, r.name AS role
       FROM employee e
       JOIN role r ON r.role_id = e.role_id
      WHERE e.username = $1`,
    [username]
  );
  return result.rows[0] as
    | (Omit<EmployeeUser, "kind"> & { password_hash: string })
    | undefined;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const kind = body.kind === "employee" ? "employee" : "customer";

  if (!username || !password) {
    return NextResponse.json(
      { error: "username and password are required" },
      { status: 400 }
    );
  }

  try {
    if (kind === "customer") {
      const customer = await findCustomer(username);
      if (customer && (await verifyPassword(password, customer.password_hash))) {
        const { password_hash: _ignored, ...rest } = customer;
        const user: CustomerUser = { kind: "customer", ...rest };
        const response = NextResponse.json({ user });
        response.cookies.set(
          COOKIE_NAME,
          signToken({ sub: user.customer_id, kind: "customer", username }),
          authCookieOptions
        );
        return response;
      }
      // Fall through to employee lookup only when the customer does not
      // exist at all, so a wrong customer password stays a hard failure.
      if (customer) {
        return NextResponse.json(INVALID, { status: 401 });
      }
    }

    const employee = await findEmployee(username);
    if (
      employee &&
      employee.active &&
      (await verifyPassword(password, employee.password_hash))
    ) {
      const { password_hash: _ignored, ...rest } = employee;
      const user: EmployeeUser = { kind: "employee", ...rest };
      const response = NextResponse.json({ user });
      response.cookies.set(
        COOKIE_NAME,
        signToken({
          sub: user.employee_id,
          kind: "employee",
          username,
          role: user.role,
        }),
        authCookieOptions
      );
      return response;
    }

    return NextResponse.json(INVALID, { status: 401 });
  } catch (err) {
    console.error("login failed:", err);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
