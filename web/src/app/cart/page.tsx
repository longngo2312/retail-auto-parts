"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

// Cart page — items live in the cart context + localStorage.
export default function CartPage() {
  const { items, remove, setQuantity, clear, subtotal } = useCart();

  return (
    <div>
      <h1>Cart</h1>
      {items.length === 0 ? (
        <p>
          Your cart is empty. <Link href="/">Browse parts</Link>
        </p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Part #</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Line total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.part_id}>
                  <td>{item.name}</td>
                  <td>{item.part_number}</td>
                  <td>${item.price.toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        setQuantity(item.part_id, Number(e.target.value))
                      }
                      style={{ width: 60 }}
                    />
                  </td>
                  <td>${(item.price * item.quantity).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => remove(item.part_id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>Subtotal: ${subtotal.toFixed(2)}</strong> (tax is
            calculated at checkout from the store&apos;s tax rate)
          </p>
          <button type="button" onClick={clear}>
            Clear Cart
          </button>{" "}
          <Link href="/checkout">Go to Checkout</Link>
        </>
      )}
    </div>
  );
}
