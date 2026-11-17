"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { CustomerUser, Store } from "@/lib/types";

interface MyVehicle {
  customer_vehicle_id: number;
  nickname: string | null;
  vehicle_id: number;
  year: number;
  make: string;
  model: string;
  engine: string;
}

// Protected account page (middleware redirects to /login when signed out).
// Profile and vehicles are wired to real APIs; orders are still pending
// backend work — see BACKEND_TODO.md.
export default function AccountPage() {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [vehicles, setVehicles] = useState<MyVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    year: "",
    make: "",
    model: "",
    engine: "",
    nickname: "",
  });

  const loadVehicles = () => {
    fetch("/api/customers/me/vehicles")
      .then((res) => res.json())
      .then((data) => setVehicles(data.vehicles ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/customers/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user as CustomerUser);
        else setError(data.error ?? "Could not load your account");
      })
      .catch(() => setError("Could not load your account"));
    fetch("/api/stores")
      .then((res) => res.json())
      .then((data) => setStores(data.stores ?? []))
      .catch(() => {});
    loadVehicles();
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileMsg(null);
    const res = await fetch("/api/customers/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        preferred_store_id: user.preferred_store_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setProfileMsg(data.error ?? "Save failed");
      return;
    }
    setUser(data.user as CustomerUser);
    setProfileMsg("Profile saved.");
  };

  const addVehicle = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/customers/me/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: Number(vehicleForm.year),
        make: vehicleForm.make,
        model: vehicleForm.model,
        engine: vehicleForm.engine,
        nickname: vehicleForm.nickname || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add vehicle");
      return;
    }
    setVehicleForm({ year: "", make: "", model: "", engine: "", nickname: "" });
    loadVehicles();
  };

  const removeVehicle = async (customerVehicleId: number) => {
    await fetch(
      `/api/customers/me/vehicles?customer_vehicle_id=${customerVehicleId}`,
      { method: "DELETE" }
    );
    loadVehicles();
  };

  if (error) return <p className="error">{error}</p>;
  if (!user) return <p>Loading…</p>;

  return (
    <div>
      <h1>My Account</h1>
      <p>
        Signed in as <strong>{user.username}</strong> (customer #
        {user.customer_id})
      </p>

      <h2>Profile</h2>
      {profileMsg && <p>{profileMsg}</p>}
      <form onSubmit={saveProfile}>
        <div>
          <label htmlFor="first_name">First name:</label>
          <input
            id="first_name"
            value={user.first_name}
            onChange={(e) => setUser({ ...user, first_name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="last_name">Last name:</label>
          <input
            id="last_name"
            value={user.last_name}
            onChange={(e) => setUser({ ...user, last_name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={user.email}
            onChange={(e) => setUser({ ...user, email: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="phone">Phone:</label>
          <input
            id="phone"
            value={user.phone}
            onChange={(e) => setUser({ ...user, phone: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="address">Address:</label>
          <input
            id="address"
            value={user.address}
            onChange={(e) => setUser({ ...user, address: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="preferred_store_id">Preferred store:</label>
          <select
            id="preferred_store_id"
            value={user.preferred_store_id ?? ""}
            onChange={(e) =>
              setUser({
                ...user,
                preferred_store_id: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          >
            <option value="">No preference</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Save Profile</button>
      </form>

      <h2>My Vehicles</h2>
      {vehicles.length === 0 ? (
        <p>No vehicles yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Make</th>
              <th>Model</th>
              <th>Engine</th>
              <th>Nickname</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.customer_vehicle_id}>
                <td>{v.year}</td>
                <td>{v.make}</td>
                <td>{v.model}</td>
                <td>{v.engine}</td>
                <td>{v.nickname ?? ""}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => removeVehicle(v.customer_vehicle_id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={addVehicle}>
        <div>
          <label htmlFor="v_year">Year:</label>
          <input
            id="v_year"
            value={vehicleForm.year}
            onChange={(e) =>
              setVehicleForm({ ...vehicleForm, year: e.target.value })
            }
            required
          />
        </div>
        <div>
          <label htmlFor="v_make">Make:</label>
          <input
            id="v_make"
            value={vehicleForm.make}
            onChange={(e) =>
              setVehicleForm({ ...vehicleForm, make: e.target.value })
            }
            required
          />
        </div>
        <div>
          <label htmlFor="v_model">Model:</label>
          <input
            id="v_model"
            value={vehicleForm.model}
            onChange={(e) =>
              setVehicleForm({ ...vehicleForm, model: e.target.value })
            }
            required
          />
        </div>
        <div>
          <label htmlFor="v_engine">Engine:</label>
          <input
            id="v_engine"
            value={vehicleForm.engine}
            onChange={(e) =>
              setVehicleForm({ ...vehicleForm, engine: e.target.value })
            }
            required
          />
        </div>
        <div>
          <label htmlFor="v_nickname">Nickname:</label>
          <input
            id="v_nickname"
            value={vehicleForm.nickname}
            onChange={(e) =>
              setVehicleForm({ ...vehicleForm, nickname: e.target.value })
            }
          />
        </div>
        <button type="submit">Add Vehicle</button>
      </form>

      <h2>My Orders</h2>
      <div className="notice">
        Backend pending — order history is not built yet. See
        BACKEND_TODO.md (&quot;Orders &amp; checkout&quot;).
      </div>
      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date</th>
            <th>Store</th>
            <th>Status</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={5}>No data yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
