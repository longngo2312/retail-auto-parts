// Shared types for the Retail Auto Parts web app.
// Field names mirror backend/db/schema.sql.

export type UserKind = "customer" | "employee";

export interface AuthPayload {
  sub: number; // customer_id or employee_id
  kind: UserKind;
  username: string;
  role?: string; // employees only: clerk | manager | admin
}

export interface CustomerUser {
  kind: "customer";
  customer_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  preferred_store_id: number | null;
}

export interface EmployeeUser {
  kind: "employee";
  employee_id: number;
  username: string;
  first_name: string;
  last_name: string;
  store_id: number;
  role: string; // clerk | manager | admin
  active: boolean;
}

export type CurrentUser = CustomerUser | EmployeeUser;

export interface Store {
  store_id: number;
  name: string;
  address: string;
  phone: string;
  hours: string;
  tax_rate: string; // numeric from pg comes back as string
}

export interface Part {
  part_id: number;
  part_number: string;
  name: string;
  category: string;
  manufacturer: string;
  condition: "new" | "rebuilt";
  default_price: string;
  price: string; // store price if a store is selected, else default_price
  stock: number | null; // inventory quantity at selected store, else null
  warranty_months: number;
}

export interface CartItem {
  part_id: number;
  part_number: string;
  name: string;
  price: number;
  quantity: number;
}
