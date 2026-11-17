"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import type { CurrentUser } from "@/lib/types";

// Plain header/nav. Shows the signed-in user (from /api/auth/me) and a
// Logout button, or Login/Register links when signed out.
export default function Header() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { count } = useCart();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user as CurrentUser);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header>
      <nav>
        <Link href="/">Retail Auto Parts</Link>
        {" | "}
        <Link href="/cart">Cart ({count})</Link>
        {" | "}
        {loaded && user ? (
          <>
            <span>
              {user.username} ({user.kind})
            </span>{" "}
            {user.kind === "customer" && (
              <>
                <Link href="/account">My Account</Link>
                {" | "}
              </>
            )}
            {user.kind === "employee" && (
              <>
                <Link href="/staff">Staff</Link>
                {" | "}
              </>
            )}
            <button type="button" onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            {" | "}
            <Link href="/register">Register</Link>
            {" | "}
            <Link href="/staff/login">Staff Login</Link>
          </>
        )}
      </nav>
      <hr />
    </header>
  );
}
