"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmployeeUser } from "@/lib/types";

// Protected staff dashboard (middleware requires an employee token).
export default function StaffDashboardPage() {
  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.kind === "employee") {
          setUser(data.user as EmployeeUser);
        } else {
          setError("Employee account required");
        }
      })
      .catch(() => setError("Could not load your staff account"));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!user) return <p>Loading…</p>;

  return (
    <div>
      <h1>Staff Dashboard</h1>
      <p>
        Signed in as <strong>{user.username}</strong> — {user.first_name}{" "}
        {user.last_name}, role: {user.role}, store #{user.store_id}
      </p>
      <ul>
        <li>
          <Link href="/staff/orders">Orders</Link> — customer orders and
          status flow
        </li>
        <li>
          <Link href="/staff/inventory">Inventory</Link> — per-store stock
          and prices
        </li>
        <li>
          <Link href="/staff/purchase-orders">Purchase Orders</Link> —
          supplier orders and receiving
        </li>
        <li>
          <Link href="/staff/returns">Returns</Link> — part returns and
          refunds
        </li>
        <li>
          <Link href="/staff/employees">Employees</Link> — staff accounts
          and roles
        </li>
      </ul>
    </div>
  );
}
