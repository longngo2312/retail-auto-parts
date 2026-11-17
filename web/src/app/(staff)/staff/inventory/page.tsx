"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Store } from "@/types";

interface InventoryRow {
  part_id: number;
  store_id: number;
  quantity: number;
  reorder_threshold: number;
  part_number: string;
  part_name: string;
  store_name: string;
}

// Staff inventory page — wired to /api/inventory (list + upsert).
// NOTE: the upsert sets quantity directly; audited adjustments with
// inventory_audit rows are core logic — see BACKEND_TODO.md.
export default function StaffInventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    part_id: "",
    store_id: "",
    quantity: "",
    reorder_threshold: "0",
  });

  const load = () => {
    const params = new URLSearchParams();
    if (storeId) params.set("store_id", storeId);
    fetch(`/api/inventory?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setError(null);
          setRows(data.inventory ?? []);
        }
      })
      .catch(() => setError("Could not load inventory"));
  };

  useEffect(load, [storeId]);

  useEffect(() => {
    fetch("/api/stores")
      .then((res) => res.json())
      .then((data) => setStores(data.stores ?? []))
      .catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        part_id: Number(form.part_id),
        store_id: Number(form.store_id),
        quantity: Number(form.quantity),
        reorder_threshold: Number(form.reorder_threshold),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setForm({ part_id: "", store_id: "", quantity: "", reorder_threshold: "0" });
    load();
  };

  return (
    <div>
      <h1>Inventory</h1>
      <div>
        <label htmlFor="store_filter">Store:</label>
        <select
          id="store_filter"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.store_id} value={s.store_id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Store</th>
            <th>Part #</th>
            <th>Part</th>
            <th>Quantity</th>
            <th>Reorder threshold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.part_id}-${row.store_id}`}>
              <td>{row.store_name}</td>
              <td>{row.part_number}</td>
              <td>{row.part_name}</td>
              <td>{row.quantity}</td>
              <td>{row.reorder_threshold}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>No inventory rows.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Set quantity (upsert)</h2>
      <form onSubmit={submit}>
        <div>
          <label htmlFor="part_id">Part ID:</label>
          <input
            id="part_id"
            value={form.part_id}
            onChange={(e) => setForm({ ...form, part_id: e.target.value })}
            required
          />
        </div>
        <div>
          <label htmlFor="inv_store_id">Store:</label>
          <select
            id="inv_store_id"
            value={form.store_id}
            onChange={(e) => setForm({ ...form, store_id: e.target.value })}
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
          <label htmlFor="quantity">Quantity:</label>
          <input
            id="quantity"
            type="number"
            min={0}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
          />
        </div>
        <div>
          <label htmlFor="reorder_threshold">Reorder threshold:</label>
          <input
            id="reorder_threshold"
            type="number"
            min={0}
            value={form.reorder_threshold}
            onChange={(e) =>
              setForm({ ...form, reorder_threshold: e.target.value })
            }
          />
        </div>
        <button type="submit">Save</button>
      </form>
    </div>
  );
}
