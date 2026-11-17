import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import {
  jsonError,
  requireEmployee,
  requireRole,
  missingFields,
  readJson,
  dbErrorResponse,
} from "@/lib/api";

// Employees are staff data: reads require an employee token, writes
// require a manager or admin role. password_hash is never returned.

// GET /api/employees?include_inactive=1 — list employees with role names.
export async function GET(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const includeInactive =
    new URL(request.url).searchParams.get("include_inactive") === "1";

  try {
    const result = await pool.query(
      `SELECT e.employee_id, e.store_id, e.role_id, e.username,
              e.first_name, e.last_name, e.department, e.hire_date,
              e.salary, e.active, e.terminated_on, r.name AS role
         FROM employee e
         JOIN role r ON r.role_id = e.role_id
        WHERE ($1 OR e.active)
        ORDER BY e.last_name, e.first_name`,
      [includeInactive]
    );
    return NextResponse.json({ employees: result.rows });
  } catch (err) {
    return dbErrorResponse(err, "list employees");
  }
}

// POST /api/employees — create an employee (manager/admin only).
// Body: { username, password, first_name, last_name, store_id,
//         role_id OR role (name: clerk|manager|admin),
//         department?, hire_date?, salary? }
// The password is bcrypt-hashed; only the hash is stored.
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["manager", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  const missing = missingFields(body, [
    "username",
    "password",
    "first_name",
    "last_name",
    "store_id",
  ]);
  if (missing.length > 0) {
    return jsonError(`Missing required fields: ${missing.join(", ")}`, 400);
  }
  if (body.role_id === undefined && body.role === undefined) {
    return jsonError("Provide role_id or role (clerk|manager|admin)", 400);
  }
  const password = String(body.password);
  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters", 400);
  }

  try {
    let roleId: number;
    if (body.role_id !== undefined) {
      roleId = Number(body.role_id);
      if (!Number.isInteger(roleId)) {
        return jsonError("role_id must be an integer", 400);
      }
    } else {
      const roleResult = await pool.query(
        "SELECT role_id FROM role WHERE name = $1",
        [String(body.role)]
      );
      if (roleResult.rows.length === 0) {
        return jsonError(
          "Unknown role — expected clerk, manager or admin",
          400
        );
      }
      roleId = roleResult.rows[0].role_id;
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO employee
         (store_id, role_id, username, password_hash, first_name, last_name,
          department, hire_date, salary)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               COALESCE($8::date, CURRENT_DATE), $9)
       RETURNING employee_id, store_id, role_id, username, first_name,
                 last_name, department, hire_date, salary, active,
                 terminated_on`,
      [
        Number(body.store_id),
        roleId,
        String(body.username).trim(),
        passwordHash,
        String(body.first_name).trim(),
        String(body.last_name).trim(),
        body.department ? String(body.department).trim() : null,
        body.hire_date ? String(body.hire_date) : null,
        body.salary === undefined ? null : Number(body.salary),
      ]
    );
    return NextResponse.json(
      { employee: result.rows[0] },
      { status: 201 }
    );
  } catch (err) {
    // 23505: username taken -> 409. 23503: store/role missing -> 400.
    return dbErrorResponse(err, "create employee", 400);
  }
}
