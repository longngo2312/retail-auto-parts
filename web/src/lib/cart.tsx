"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Part } from "./types";

// Client-side cart, persisted to localStorage. Prices are the price seen
// when the item was added; the final price is always the price at time of
// sale, confirmed by the backend when order placement is built.

interface CartContextValue {
  items: CartItem[];
  add: (part: Part) => void;
  remove: (partId: number) => void;
  setQuantity: (partId: number, quantity: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "retail-auto-parts-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // corrupted storage — start with an empty cart
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable — cart still works in memory
    }
  }, [items]);

  const add = (part: Part) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.part_id === part.part_id);
      if (existing) {
        return prev.map((i) =>
          i.part_id === part.part_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          part_id: part.part_id,
          part_number: part.part_number,
          name: part.name,
          price: Number(part.price),
          quantity: 1,
        },
      ];
    });
  };

  const remove = (partId: number) => {
    setItems((prev) => prev.filter((i) => i.part_id !== partId));
  };

  const setQuantity = (partId: number, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.part_id !== partId)
        : prev.map((i) => (i.part_id === partId ? { ...i, quantity } : i))
    );
  };

  const clear = () => setItems([]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, add, remove, setQuantity, clear, subtotal, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
