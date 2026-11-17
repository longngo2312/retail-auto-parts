"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Part } from "@/types";
import AddToCartButton from "../../_components/AddToCartButton";

interface VehicleFit {
  vehicle_id: number;
  year: number;
  make: string;
  model: string;
  engine: string;
}

// Part detail page, fed by /api/parts/[id].
export default function PartDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [part, setPart] = useState<Part | null>(null);
  const [fits, setFits] = useState<VehicleFit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/parts/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setPart(data.part as Part);
          setFits(data.fits_vehicles ?? []);
        }
      })
      .catch(() => setError("Could not load part"));
  }, [id]);

  if (error) {
    return (
      <div>
        <p className="error">{error}</p>
        <Link href="/">Back to storefront</Link>
      </div>
    );
  }
  if (!part) return <p>Loading…</p>;

  return (
    <div>
      <h1>{part.name}</h1>
      <table>
        <tbody>
          <tr>
            <th>Part number</th>
            <td>{part.part_number}</td>
          </tr>
          <tr>
            <th>Manufacturer</th>
            <td>{part.manufacturer}</td>
          </tr>
          <tr>
            <th>Category</th>
            <td>{part.category}</td>
          </tr>
          <tr>
            <th>Condition</th>
            <td>{part.condition}</td>
          </tr>
          <tr>
            <th>Price</th>
            <td>${Number(part.price).toFixed(2)}</td>
          </tr>
          <tr>
            <th>Warranty</th>
            <td>{part.warranty_months} months</td>
          </tr>
        </tbody>
      </table>

      <AddToCartButton part={part} />

      <h2>Fits these vehicles</h2>
      {fits.length === 0 ? (
        <p>No fitment data for this part.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Make</th>
              <th>Model</th>
              <th>Engine</th>
            </tr>
          </thead>
          <tbody>
            {fits.map((v) => (
              <tr key={v.vehicle_id}>
                <td>{v.year}</td>
                <td>{v.make}</td>
                <td>{v.model}</td>
                <td>{v.engine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <Link href="/">Back to storefront</Link>
      </p>
    </div>
  );
}
