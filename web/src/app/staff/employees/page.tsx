"use client";

import { useEffect, useState } from "react";

interface EmployeeRow {
  employee_id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  store_id: number;
  department: string | null;
  hire_date: string;
  active: boolean;
}

// Staff employees page — wired to GET /api/employees.
// Creating/deactivating employees uses the same API (manager/admin only)
// and is done via API calls for now; a form UI can come later.
export default function StaffEmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/employees?include_inactive=1")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setEmployees(data.employees ?? []);
      })
      .catch(() => setError("Could not load employees"));
  }, []);

  return (
    <div>
      <h1>Employees</h1>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Name</th>
            <th>Role</th>
            <th>Store</th>
            <th>Department</th>
            <th>Hire date</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.employee_id}>
              <td>{e.username}</td>
              <td>
                {e.first_name} {e.last_name}
              </td>
              <td>{e.role}</td>
              <td>{e.store_id}</td>
              <td>{e.department ?? ""}</td>
              <td>{String(e.hire_date).slice(0, 10)}</td>
              <td>{e.active ? "yes" : "no"}</td>
            </tr>
          ))}
          {employees.length === 0 && !error && (
            <tr>
              <td colSpan={7}>No employees found.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p>
        Create, update and deactivate employees via POST / PUT /
        DELETE /api/employees (manager or admin role). Employees are
        deactivated, never deleted.
      </p>
    </div>
  );
}
