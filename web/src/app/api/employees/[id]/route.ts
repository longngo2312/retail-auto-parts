import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  requireRole,
  collectUpdates,
  readJson,
  dbErrorResponse,
  parseId,
} from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

const SELECT_EMPLOYEE = `
  SELECT e.employee_id, e.store_id, e.role_id, e.username,
         e.first_name, e.last_name, e.department, e.hire_date,
         e.salary, e.active, e.terminated_on, r.name AS role
    FROM employee e
    JOIN role r ON r.role_id = e.role_id
   WHERE e.employee_id = $1`;

// GET /api/employees/[id] — detail (employees only).
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid employee id", 400);

  try {
    const result = await pool.query(SELECT_EMPLOYEE, [id]);
    if (result.rows.length === 0) {
      return jsonError("Employee not found", 404);
    }
    return NextResponse.json({ employee: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "get employee");
  }
}

// PUT/PATCH /api/employees/[id] — partial update (manager/admin only).
// Role may be changed via role_id, or via role (name) which is resolved
// to role_id first. Password changes are not handled here.
async function updateEmployee(request: NextRequest, context: RouteContext) {
  const auth = await requireRole(request, ["manager", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid employee id", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  try {
    if (body.role !== undefined && body.role_id === undefined) {
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
      body.role_id = roleResult.rows[0].role_id;
    }

    const updates = collectUpdates(body, [
      "store_id",
      "role_id",
      "username",
      "first_name",
      "last_name",
      "department",
      "hire_date",
      "salary",
      "active",
      "terminated_on",
    ]);
    if (!updates) return jsonError("No updatable fields provided", 400);

    const result = await pool.query(
      `UPDATE employee SET ${updates.setSql}
        WHERE employee_id = $${updates.values.length + 1}
        RETURNING employee_id`,
      [...updates.values, id]
    );
    if (result.rows.length === 0) {
      return jsonError("Employee not found", 404);
    }
    const fresh = await pool.query(SELECT_EMPLOYEE, [id]);
    return NextResponse.json({ employee: fresh.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "update employee", 400);
  }
}

export const PUT = updateEmployee;
export const PATCH = updateEmployee;

// DELETE /api/employees/[id] — SOFT deactivate (manager/admin only):
// active = false and terminated_on set. Employees are never hard-deleted
// (req 21), and the schema CHECK requires terminated_on whenever
// active is false, so both are set together.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireRole(request, ["manager", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid employee id", 400);

  try {
    const result = await pool.query(
      `UPDATE employee
          SET active = false,
              terminated_on = COALESCE(terminated_on, CURRENT_DATE)
        WHERE employee_id = $1
        RETURNING employee_id`,
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Employee not found", 404);
    }
    const fresh = await pool.query(SELECT_EMPLOYEE, [id]);
    return NextResponse.json({ employee: fresh.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "deactivate employee");
  }
}
