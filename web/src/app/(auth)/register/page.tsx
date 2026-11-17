"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Store } from "@/types";

// Customer registration — posts to /api/auth/register, which bcrypt-hashes
// the password and inserts the customer row.
export default function RegisterPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    preferred_store_id: "",
  });
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        preferred_store_id: form.preferred_store_id
          ? Number(form.preferred_store_id)
          : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }
    router.push("/account");
    router.refresh();
  };

  return (
    <div>
      <h1>Register</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={submit}>
        <div>
          <label htmlFor="username">Username:</label>
          <input
            id="username"
            value={form.username}
            onChange={set("username")}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password (min 8 chars):</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
          />
        </div>
        <div>
          <label htmlFor="first_name">First name:</label>
          <input
            id="first_name"
            value={form.first_name}
            onChange={set("first_name")}
            required
          />
        </div>
        <div>
          <label htmlFor="last_name">Last name:</label>
          <input
            id="last_name"
            value={form.last_name}
            onChange={set("last_name")}
            required
          />
        </div>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
          />
        </div>
        <div>
          <label htmlFor="phone">Phone:</label>
          <input
            id="phone"
            value={form.phone}
            onChange={set("phone")}
            required
          />
        </div>
        <div>
          <label htmlFor="address">Address:</label>
          <input
            id="address"
            value={form.address}
            onChange={set("address")}
            required
          />
        </div>
        <div>
          <label htmlFor="preferred_store_id">Preferred store:</label>
          <select
            id="preferred_store_id"
            value={form.preferred_store_id}
            onChange={set("preferred_store_id")}
          >
            <option value="">No preference</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Create Account</button>
      </form>
      <p>
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
