"use client";

import Link from "next/link";
import type { Part } from "@/types";
import AddToCartButton from "./AddToCartButton";

// Storefront search-results table (home page). Prices and stock are the
// per-store values returned by /api/parts for the selected store.
// Segment-local: lives in the (storefront) private _components folder.
export default function PartsTable({
  parts,
  error,
}: {
  parts: Part[];
  error: string | null;
}) {
  return (
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
              <AddToCartButton part={part} />
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
  );
}
