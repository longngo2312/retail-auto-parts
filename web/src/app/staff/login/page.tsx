"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Employee login — same /api/auth/login endpoint with kind = "employee".
// Only active employees can sign in; the token carries their role.
export default function StaffLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, kind: "employee" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    if (data.user.kind !== "employee") {
      setError("That account is not an employee account");
      return;
    }
    router.push("/staff");
    router.refresh();
  };

  return (
    <div>
      <h1>Staff Login</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={submit}>
        <div>
          <label htmlFor="username">Employee username:</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Log In</button>
      </form>
    </div>
  );
}
