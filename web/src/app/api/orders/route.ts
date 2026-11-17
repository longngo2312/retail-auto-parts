import { NextResponse } from "next/server";

// POST /api/orders — STUB.
// Order placement is core logic that is not built yet: it needs a single
// transaction that locks inventory rows FOR UPDATE, decrements stock,
// snapshots the price at time of sale, and computes tax from
// store.tax_rate. See BACKEND_TODO.md ("Orders & checkout").
// Until then this returns 501 instead of pretending an order was placed.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Order placement is not implemented yet — see BACKEND_TODO.md",
    },
    { status: 501 }
  );
}
