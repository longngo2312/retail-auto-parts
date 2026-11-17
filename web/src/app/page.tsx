"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import type { Part, Store } from "@/lib/types";

// Storefront home: pick a store, search parts, add to cart.
// Prices and stock come from /api/parts for the selected store.
export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [q, setQ] = useState("");
  const [parts, setParts] = useState<Part[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { add } = useCart();

  useEffect(() => {
    fetch("/api/stores")
      .then((res) => res.json())
      .then((data) => setStores(data.stores ?? []))
      .catch(() => setError("Could not load stores"));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (storeId) params.set("store_id", storeId);
    fetch(`/api/parts?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setParts([]);
        } else {
          setError(null);
          setParts(data.parts ?? []);
        }
      })
      .catch(() => setError("Could not load parts"));
  }, [q, storeId]);

  return (
    <div>
      <h1>Retail Auto Parts — Storefront</h1>

      <div>
        <label htmlFor="store">Store:</label>
        <select
          id="store"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">All stores (default prices)</option>
          {stores.map((s) => (
            <option key={s.store_id} value={s.store_id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="search">Search parts:</label>
        <input
          id="search"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Part name or part number"
        />
      </div>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Part #</th>
            <th>Manufacturer</th>
            <th>Category</th>
            <th>Condition</th>
            <th>Price</th>
            <th>Stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => (
            <tr key={part.part_id}>
              <td>
                <Link href={`/parts/${part.part_id}`}>{part.name}</Link>
              </td>
              <td>{part.part_number}</td>
              <td>{part.manufacturer}</td>
              <td>{part.category}</td>
              <td>{part.condition}</td>
              <td>${Number(part.price).toFixed(2)}</td>
              <td>{part.stock === null ? "—" : part.stock}</td>
              <td>
                <button type="button" onClick={() => add(part)}>
                  Add to Cart
                </button>
              </td>
            </tr>
          ))}
          {parts.length === 0 && !error && (
            <tr>
              <td colSpan={8}>No parts found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
