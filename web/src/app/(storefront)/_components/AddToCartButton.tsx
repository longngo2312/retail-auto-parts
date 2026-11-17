"use client";

import { useCart } from "@/hooks/useCart";
import type { Part } from "@/types";

// Segment-local component for the (storefront) route group — used by the
// home page parts table and the part detail page. Private folder: the
// underscore prefix keeps it out of routing.
export default function AddToCartButton({ part }: { part: Part }) {
  const { add } = useCart();
  return (
    <button type="button" onClick={() => add(part)}>
      Add to Cart
    </button>
  );
}
