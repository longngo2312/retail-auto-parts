"use client";

import { useContext } from "react";
import { CartContext, type CartContextValue } from "@/context/CartContext";

// Hook for the client-side cart. The provider lives in
// src/context/CartContext.tsx and is mounted by the root layout.
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
