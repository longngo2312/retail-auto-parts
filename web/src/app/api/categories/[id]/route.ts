import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  jsonError,
  requireEmployee,
  collectUpdates,
  readJson,
  dbErrorResponse,
  parseId,
} from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/categories/[id] — public detail.
export async function GET(_request: NextRequest, context: RouteContext) {
  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid category id", 400);

  try {
    const result = await pool.query(
      "SELECT category_id, parent_id, name FROM category WHERE category_id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Category not found", 404);
    }
    return NextResponse.json({ category: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "get category");
  }
}

// PUT/PATCH /api/categories/[id] — partial update (employees only).
// parent_id may be set to null to make the category top-level.
async function updateCategory(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid category id", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body", 400);

  if (body.parent_id !== undefined && body.parent_id !== null) {
    if (Number(body.parent_id) === id) {
      return jsonError("A category cannot be its own parent", 400);
    }
  }

  const updates = collectUpdates(body, ["name", "parent_id"]);
  if (!updates) return jsonError("No updatable fields provided", 400);

  try {
    const result = await pool.query(
      `UPDATE category SET ${updates.setSql}
        WHERE category_id = $${updates.values.length + 1}
        RETURNING *`,
      [...updates.values, id]
    );
    if (result.rows.length === 0) {
      return jsonError("Category not found", 404);
    }
    return NextResponse.json({ category: result.rows[0] });
  } catch (err) {
    return dbErrorResponse(err, "update category", 400);
  }
}

export const PUT = updateCategory;
export const PATCH = updateCategory;

// DELETE /api/categories/[id] — hard delete (employees only).
// Returns 409 when subcategories or parts still reference the category.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireEmployee(request);
  if (auth instanceof NextResponse) return auth;

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("Invalid category id", 400);

  try {
    const result = await pool.query(
      "DELETE FROM category WHERE category_id = $1 RETURNING category_id",
      [id]
    );
    if (result.rows.length === 0) {
      return jsonError("Category not found", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err, "delete category", 409);
  }
}
