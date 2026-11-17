"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useCart } from "@/hooks/useCart";
import type { Store } from "@/types";

// Checkout form. Submitting posts to /api/orders, which is still a stub
// (501) — order placement is core backend logic (inventory locking, tax,
// price-at-sale) that is not built yet. See BACKEND_TODO.md.
// This page honestly shows that pending state; it never fakes an order.
//
// Card fields collect brand + last 4 digits ONLY. Full card numbers are
// never entered, sent, or stored (schema §8.4: brand, last4, provider
// token only).
export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState({
    store_id: "",
    method: "pickup",
    address: "",
    card_brand: "Visa",
    card_last4: "",
    billing_address: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stores")
      .then((res) => res.json())
      .then((data) => setStores(data.stores ?? []))
      .catch(() => {});
  }, []);

  const set = (field: string) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_id: form.store_id ? Number(form.store_id) : null,
        method: form.method,
        address: form.method === "ship" ? form.address : null,
        items: items.map((i) => ({
          part_id: i.part_id,
          quantity: i.quantity,
        })),
        payment: {
          card_brand: form.card_brand,
          card_last4: form.card_last4,
          billing_address: form.billing_address,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 501) {
      setMessage(
        "Order API pending: order placement is not implemented yet — see BACKEND_TODO.md. Your cart has been kept."
      );
      return;
    }
    if (!res.ok) {
      setMessage(data.error ?? "Checkout failed");
      return;
    }
    setMessage("Order placed.");
  };

  if (items.length === 0) {
    return (
      <div>
        <h1>Checkout</h1>
        <p>
          Your cart is empty. <Link href="/">Browse parts</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Checkout</h1>
      <p>
        {items.length} item(s) — subtotal ${subtotal.toFixed(2)} (tax added
        by the backend at order time)
      </p>
      {message && <div className="notice">{message}</div>}
      <form onSubmit={submit}>
        <div>
          <label htmlFor="store_id">Fulfillment store:</label>
          <select
            id="store_id"
            value={form.store_id}
            onChange={set("store_id")}
            required
          >
            <option value="">Select a store</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Delivery method:</label>
          <label>
            <input
              type="radio"
              name="method"
              value="pickup"
              checked={form.method === "pickup"}
              onChange={set("method")}
            />{" "}
            Pickup
          </label>
          <label>
            <input
              type="radio"
              name="method"
              value="ship"
              checked={form.method === "ship"}
              onChange={set("method")}
            />{" "}
            Ship
          </label>
        </div>
        {form.method === "ship" && (
          <div>
            <label htmlFor="address">Shipping address:</label>
            <input
              id="address"
              value={form.address}
              onChange={set("address")}
              required
            />
          </div>
        )}
        <fieldset>
          <legend>Payment (test fields)</legend>
          <p>
            Only the card brand and last 4 digits are collected. Full card
            numbers are never stored in this system.
          </p>
          <div>
            <label htmlFor="card_brand">Card brand:</label>
            <select
              id="card_brand"
              value={form.card_brand}
              onChange={set("card_brand")}
            >
              <option>Visa</option>
              <option>Mastercard</option>
              <option>Amex</option>
              <option>Discover</option>
            </select>
          </div>
          <div>
            <label htmlFor="card_last4">Last 4 digits:</label>
            <input
              id="card_last4"
              value={form.card_last4}
              onChange={set("card_last4")}
              pattern="[0-9]{4}"
              maxLength={4}
              required
            />
          </div>
          <div>
            <label htmlFor="billing_address">Billing address:</label>
            <input
              id="billing_address"
              value={form.billing_address}
              onChange={set("billing_address")}
              required
            />
          </div>
        </fieldset>
        <button type="submit">Place Order</button>
      </form>
    </div>
  );
}
