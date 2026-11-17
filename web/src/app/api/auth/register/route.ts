import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  hashPassword,
  signToken,
  COOKIE_NAME,
  authCookieOptions,
} from "@/lib/auth";
import type { CustomerUser } from "@/lib/types";

// POST /api/auth/register — create a customer account.
// Body: { username, password, first_name, last_name, email, phone, address,
//         preferred_store_id? }
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const preferredStoreId =
    body.preferred_store_id === undefined ||
    body.preferred_store_id === null ||
    body.preferred_store_id === ""
      ? null
      : Number(body.preferred_store_id);

  if (!username || !firstName || !lastName || !email || !phone || !address) {
    return NextResponse.json(
      {
        error:
          "username, password, first_name, last_name, email, phone and address are all required",
      },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (preferredStoreId !== null && !Number.isInteger(preferredStoreId)) {
    return NextResponse.json(
      { error: "preferred_store_id must be a store id" },
      { status: 400 }
    );
  }

  try {
    // Uniqueness checks (customer.username and customer.email are UNIQUE,
    // but check first so we can return a clear message).
    const existing = await pool.query(
      "SELECT username, email FROM customer WHERE username = $1 OR email = $2",
      [username, email]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const field = row.username === username ? "username" : "email";
      return NextResponse.json(
        { error: `That ${field} is already registered` },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const inserted = await pool.query(
      `INSERT INTO customer
         (username, password_hash, first_name, last_name, email, phone, address, preferred_store_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING customer_id, username, first_name, last_name, email, phone, address, preferred_store_id`,
      [
        username,
        passwordHash,
        firstName,
        lastName,
        email,
        phone,
        address,
        preferredStoreId,
      ]
    );

    const user: CustomerUser = { kind: "customer", ...inserted.rows[0] };

    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(
      COOKIE_NAME,
      signToken({ sub: user.customer_id, kind: "customer", username }),
      authCookieOptions
    );
    return response;
  } catch (err) {
    console.error("register failed:", err);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
