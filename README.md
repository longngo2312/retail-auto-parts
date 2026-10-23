# Retail Auto Parts System

CSCE 4350.001 — Fundamentals of Database Systems (Fall 2026). Database-driven auto parts
retailer: a public customer storefront and an authenticated store-mode staff application over
one shared PostgreSQL database, designed for an arbitrary number of branches.

Phase I (proposal) is submitted. This repository holds Phase II onward.

## Layout

```
db/schema.sql           tables, constraints, indexes
db/seed.sql             sample data, incl. 5,000 generated parts for the req-43 search timing
db/test_constraints.sql integrity checks; run after loading
docs/                   phase reports
```

## Run

Against the local PostgreSQL install (18, at `C:\Program Files\PostgreSQL\18\bin`). Create the
database and load it:

```bash
psql -U postgres -c "CREATE DATABASE autoparts"
psql -U postgres -d autoparts -v ON_ERROR_STOP=1 -f db/schema.sql -f db/seed.sql
```

Verify the integrity rules:

```bash
psql -U postgres -d autoparts -v ON_ERROR_STOP=1 -f db/test_constraints.sql
```

To reload from scratch, drop and repeat:

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS autoparts"
```

The schema was developed and tested against PostgreSQL 17 and uses nothing version-specific.

## ER diagram

Generated from the DDL rather than maintained separately — paste `db/schema.sql` into
dbdiagram.io (Import → PostgreSQL) and export the image for the Phase II report. Keeping a
second hand-written DBML file would just drift from the schema.

## Design notes carried from Phase I

- Inventory and price are per store (`inventory`, `store_price`), never columns on `part` (§8.2).
- `vehicle` is a shared catalog row; `customer_vehicle` is a customer's instance of it (§8.3).
- No card numbers are ever stored — brand, last four, provider token only (§8.4).
- Order placement locks inventory rows `FOR UPDATE`; `CHECK (quantity >= 0)` is the backstop (§8.5).
- Soft deletes throughout (`employee.active`, `part.discontinued`); order lines store the price
  at time of sale so past revenue does not move (§8.6).
- Money is `numeric(12,2)` via the `money_amt` domain, never floating point (req 6).
- Open question: `category.parent_id` allows a hierarchy; a flat two-level structure is the
  fallback if recursive queries get expensive (§10).

## Not here yet

Backend (Express + `pg`), frontend (React + Vite), and auth are Phase III. Nothing is scaffolded
until there is a schema to build against — that was the Phase I gate.
