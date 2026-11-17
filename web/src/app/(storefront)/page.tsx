"use client";

import { useEffect, useState } from "react";
import type { Part, Store } from "@/types";
import PartsTable from "./_components/PartsTable";

// Storefront home: pick a store, search parts, add to cart.
// Prices and stock come from /api/parts for the selected store.
export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [q, setQ] = useState("");
  const [parts, setParts] = useState<Part[]>([]);
  const [error, setError] = useState<string | null>(null);

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

      <PartsTable parts={parts} error={error} />
    </div>
  );
}
