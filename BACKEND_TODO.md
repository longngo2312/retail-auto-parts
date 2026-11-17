# Backend Status & TODO — Retail Auto Parts (Phase III)

The web app lives in [`web/`](web/) (Next.js App Router + TypeScript, `pg`,
`bcryptjs`, `jsonwebtoken`). This file tracks what is built and what is left.

## How to run

```bash
# 1. Create the database and load the Phase II schema (PostgreSQL 15+)
psql -U postgres -c "CREATE DATABASE autoparts"
psql -U postgres -d autoparts -v ON_ERROR_STOP=1 -f backend/db/schema.sql
#    (plus backend/db/seed.sql if/when seed data is added)

# 2. Configure the web app
cd web
cp .env.example .env.local   # set DATABASE_URL and JWT_SECRET

# 3. Install and run
npm install
npm run dev                  # http://localhost:3000
```

Seeded users: none yet — register a customer from `/register`. Employee
accounts are created with `POST /api/employees` (needs a manager/admin
token) or by inserting a row into `employee` with a bcrypt `password_hash`
directly in SQL for the first admin.

---

## DONE

### Auth (complete)

- [x] Password hashing with bcrypt (cost 10) — only hashes are stored, in
  `customer.password_hash` / `employee.password_hash` (schema req 4, 39).
- [x] JWT sessions: HS256 token signed with `JWT_SECRET`, 7-day expiry,
  payload `{ sub, kind: 'customer'|'employee', username, role? }`, stored
  in an httpOnly cookie named `token`. `Authorization: Bearer` is also
  accepted by API routes.
- [x] `POST /api/auth/register` — customer registration: required-field and
  password-length (≥ 8) validation, username/email uniqueness checks,
  inserts into `customer`, sets the cookie.
- [x] `POST /api/auth/login` — customers by username; employees by username
  with `active = true` required and the role name joined from `role`
  (`clerk` | `manager` | `admin`). Generic 401 on bad credentials.
- [x] `POST /api/auth/logout`, `GET /api/auth/me`.
- [x] `web/src/middleware.ts` protects `/account/*` (any valid token) and
  `/staff/*` (employee token), redirecting to `/login` / `/staff/login`.
- [x] `password_hash` is never returned by any endpoint.

### Basic CRUD APIs (complete)

All routes are JSON in/out with parameterized `pg` queries. Conventions:
201 on create, 400 validation, 401 unauthenticated, 403 wrong kind/role,
404 missing, 409 unique/constraint conflicts (PostgreSQL errors are mapped
in `web/src/lib/api.ts`). Public reads: parts, categories, manufacturers,
stores, vehicles. All writes require an employee token; employee writes
require manager/admin. Customer self-service routes require a customer
token and only ever touch that customer's rows.

- [x] **Parts** (`part`, `category`, `manufacturer`) — `GET /api/parts`
  (search `?q=`, per-store price/stock via `?store_id=`,
  `COALESCE(store_price.price, part.default_price)`, discontinued
  excluded), `GET /api/parts/[id]` (includes `part_fitment` vehicles),
  POST, PUT/PATCH, DELETE = **soft delete** (`discontinued = true`).
- [x] **Categories** (`category`) — full CRUD; `parent_id` hierarchy
  respected, self-parenting rejected, duplicate `(parent_id, name)`
  surfaces as 409 from the `UNIQUE NULLS NOT DISTINCT` constraint.
- [x] **Manufacturers** (`manufacturer`) — full CRUD; delete returns 409
  while parts reference the manufacturer.
- [x] **Stores** (`store`) — GET list (active only) / detail, POST,
  PUT/PATCH, DELETE = soft (`active = false`).
- [x] **Suppliers** (`supplier`) — full CRUD (staff only); DELETE = soft
  (`active = false`).
- [x] **Vehicles** (`vehicle`) — GET list (make/model/year filters) /
  detail, POST, PUT/PATCH; DELETE is guarded: 409 while `customer_vehicle`
  or `part_fitment` rows reference it (shared catalog, no soft delete).
- [x] **Inventory** (`inventory`) — GET with `store_id` / `part_id`
  filters; POST/PUT upsert on `(part_id, store_id)` for `quantity` +
  `reorder_threshold`; DELETE row. (Direct upsert only — audited
  adjustments are TODO below.)
- [x] **Store prices** (`store_price`) — GET with filters; POST/PUT upsert
  on `(part_id, store_id)`; DELETE row.
- [x] **Customer profile** (`customer`) — `GET /api/customers/me`,
  `PUT/PATCH /api/customers/me` (first/last name, email, phone, address,
  `preferred_store_id`; no password changes here). Staff reads:
  `GET /api/customers`, `GET /api/customers/[id]`.
- [x] **Customer vehicles** (`customer_vehicle`, `vehicle`) —
  `GET/POST/DELETE /api/customers/me/vehicles`; POST accepts a
  `vehicle_id` or year/make/model/engine (find-or-create the catalog row).
- [x] **Employees** (`employee`, `role`) — GET list/detail (employee
  token); POST create (bcrypt hash, role by `role_id` or role name),
  PUT/PATCH update, DELETE = **soft deactivate** (`active = false` +
  `terminated_on = CURRENT_DATE`, satisfying the schema CHECKs; employees
  are never hard-deleted, req 21). Writes require manager/admin.

### Frontend UIs (complete, deliberately unpolished)

Storefront home with store selector + part search + add to cart, part
detail with fitment list, customer login/register, account page (profile
form and vehicle manager wired to the APIs above; orders section is a
placeholder), cart (context + localStorage), checkout form (shows the
order API's 501 pending state honestly), staff login, staff dashboard,
staff inventory page (wired to `/api/inventory`), staff employees page
(wired to `/api/employees`), and shell pages for staff orders, purchase
orders, and returns.

---

## TODO — core logic

### Orders & checkout (the big one)

Tables: `customer_order`, `customer_order_line`, `inventory`, `store_price`,
`part`, `store`, `delivery`, `payment`.

- [ ] `POST /api/orders` — currently a stub returning **501**. Implement as
  a single transaction:
  - [ ] Require a customer token; take `store_id`, cart lines, delivery
    method/address from the request.
  - [ ] Lock each line's `inventory` row `SELECT ... FOR UPDATE` (schema
    §8.5); reject the whole order if any line's `quantity` is insufficient
    (the `CHECK (quantity >= 0)` constraint is the backstop, not the plan).
  - [ ] Price each line at time of sale: `COALESCE(store_price.price,
    part.default_price)` → `customer_order_line.unit_price` (§8.6).
  - [ ] Decrement `inventory.quantity` per line.
  - [ ] Compute tax from `store.tax_rate` on the subtotal →
    `customer_order.tax_amount`.
  - [ ] Insert `customer_order` (status `placed`, `employee_id` NULL for
    web orders) + `customer_order_line` rows; commit or roll back as one
    unit.
- [ ] `GET /api/customers/me/orders` + `GET /api/customers/me/orders/[id]`
  — order history for the account page (uses
  `customer_order_history_idx`, req 16).
- [ ] Staff order list/detail: `GET /api/orders`, `GET /api/orders/[id]`
  (employee token).
- [ ] Order status flow: `PATCH /api/orders/[id]` through
  `placed → picking → dispatched → delivered` (set `delivered_on` exactly
  when status becomes `delivered` — schema CHECK) and `cancelled`.

### Payments

Tables: `payment`, `customer_order`.

- [ ] Record a payment inside (or immediately after) the order transaction:
  `card_brand`, `card_last4`, `provider_token`, `billing_address`, `amount`.
- [ ] **Never store full card numbers** (§8.4) — the checkout form only
  collects brand + last 4; a real provider token flow is out of scope, so
  generate/store a placeholder provider token and document that choice.
- [ ] Validate `card_last4` against `^[0-9]{4}$` before insert.

### Delivery

Tables: `delivery`, `customer_order`.

- [ ] Insert the `delivery` row with the order: `method` `pickup` | `ship`,
  `address` required when `ship` (schema CHECK), `cost` (0 for pickup;
  shipping fee rule still to be decided).

### Returns

Tables: `part_return`, `customer_order_line`, `inventory`, `inventory_audit`.

- [ ] `POST /api/returns` (staff): create a `part_return` against an order
  line with `quantity`, `reason`, `refund_amount`, processing `employee_id`.
- [ ] Decide and implement restocking: return quantity to `inventory` and
  write an `inventory_audit` row, in the same transaction.
- [ ] Guard: returned quantity must not exceed the order line's quantity
  minus already-returned quantity (needs an aggregate check — there is no
  schema constraint for this).
- [ ] `GET /api/returns` for the staff returns page.

### Customer vehicles & fitment search

Tables: `customer_vehicle`, `vehicle`, `part_fitment`, `part`.

- [ ] Fitment search on the storefront: "parts that fit my vehicle" —
  `GET /api/parts?vehicle_id=` joining `part_fitment`. (Basic vehicle CRUD
  and the per-part fitment list are done.)

### Staff: inventory adjustments & audit

Tables: `inventory`, `inventory_audit`.

- [ ] `POST /api/inventory/adjustments` (employee): apply a signed `delta`
  with a non-empty `reason`, writing the `inventory` update **and** the
  `inventory_audit` row (with the acting `employee_id`) in one transaction
  (req 7, 31). The plain upsert in `/api/inventory` stays for initial
  stock setup only.
- [ ] Low-stock view: rows where `quantity <= reorder_threshold`
  (staff inventory page filter / report).

### Purchase orders & receiving

Tables: `purchase_order`, `purchase_order_line`, `supplier_part`,
`inventory`, `inventory_audit`.

- [ ] `POST /api/purchase-orders` (employee): create PO in `draft` from a
  supplier + lines; default `unit_cost` from `supplier_part.cost`.
- [ ] Status flow `draft → placed → cancelled`, and
  `POST /api/purchase-orders/[id]/receive`: set `status = received` +
  `received_on` (schema CHECK ties them together), add received quantities
  into `inventory` (upsert), write `inventory_audit` rows — one transaction.
- [ ] `GET /api/purchase-orders` list/detail for the staff page.

### Employee management (remaining bits)

Tables: `employee`, `role`.

- [ ] Password reset/change flow for employees (and customers): verify the
  current password, bcrypt-hash the new one. (Basic employee CRUD is done.)
- [ ] Staff UI forms for create/update/deactivate (the API exists; the
  employees page is read-only today).

### Reports / queries

Tables: most of the schema.

- [ ] Sales by store / by day (from `customer_order` + lines, using the
  price-at-sale on the lines, never current prices).
- [ ] Inventory valuation per store (`inventory` × price).
- [ ] Best-selling parts; customers with no orders; supplier lead-time /
  cost comparison from `supplier_part`.
- [ ] Req-43 part search timing check against the 5,000-part seed (see
  README) once seed data exists in this repo.

### Hardening

- [ ] Consistent request validation everywhere (the CRUD routes validate
  the basics; order/payment inputs will need stricter checks, e.g.
  quantities, money ranges, string lengths).
- [ ] Standard error format pass: every route already returns
  `{ error: string }`; keep it that way for new routes.
- [ ] Rate-limit / lockout consideration for `/api/auth/login`.
- [ ] Seed dev users: one admin employee + one demo customer with known
  passwords, documented for local demos (seed file next to
  `backend/db/schema.sql`).
- [ ] Decide `JWT_SECRET` rotation / token revocation story (currently:
  stateless 7-day tokens, logout only clears the cookie).
