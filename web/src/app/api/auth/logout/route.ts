import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

// POST /api/auth/logout — clear the auth cookie.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
