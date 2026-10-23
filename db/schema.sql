-- Retail Auto Parts System -- Phase II schema (PostgreSQL 17)
-- Requirement ids in comments refer to Phase I section 7.

CREATE TYPE part_condition  AS ENUM ('new', 'rebuilt');          -- req 12; one condition per part row
CREATE TYPE order_status    AS ENUM ('placed', 'picking', 'dispatched', 'delivered', 'cancelled');
CREATE TYPE po_status       AS ENUM ('draft', 'placed', 'received', 'cancelled');
CREATE TYPE delivery_method AS ENUM ('pickup', 'ship');

CREATE DOMAIN money_amt AS numeric(12,2) CHECK (VALUE >= 0);     -- req 6: exact decimal, never float

-- ---------- stores, people ----------
CREATE TABLE store (                                             -- req 1: new store = one row
  store_id serial PRIMARY KEY,
  name     text NOT NULL,
  address  text NOT NULL,
  phone    text NOT NULL,
  hours    text NOT NULL,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate < 1),
  active   boolean NOT NULL DEFAULT true
);

CREATE TABLE role (
  role_id    serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,                               -- clerk | manager | admin
  is_manager boolean NOT NULL DEFAULT false                      -- req 5
);

CREATE TABLE employee (
  employee_id   serial PRIMARY KEY,
  store_id      int NOT NULL REFERENCES store,
  role_id       int NOT NULL REFERENCES role,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,                                   -- req 4, 39: bcrypt hash only
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  department    text,
  hire_date     date NOT NULL,
  salary        money_amt,
  active        boolean NOT NULL DEFAULT true,                   -- req 21: deactivate, never delete
  terminated_on date,
  CHECK (terminated_on IS NULL OR terminated_on >= hire_date),
  CHECK (active OR terminated_on IS NOT NULL)
);

CREATE TABLE customer (
  customer_id        serial PRIMARY KEY,
  username           text NOT NULL UNIQUE,
  password_hash      text NOT NULL,
  first_name         text NOT NULL,
  last_name          text NOT NULL,
  email              text NOT NULL UNIQUE,
  phone              text NOT NULL,
  address            text NOT NULL,
  preferred_store_id int REFERENCES store,                       -- req 17
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------- catalog ----------
CREATE TABLE category (                                          -- open question 10: parent_id = hierarchy
  category_id serial PRIMARY KEY,
  parent_id   int REFERENCES category,
  name        text NOT NULL,
  UNIQUE (parent_id, name)
);

CREATE TABLE manufacturer (
  manufacturer_id serial PRIMARY KEY,
  name            text NOT NULL UNIQUE
);

CREATE TABLE part (
  part_id         serial PRIMARY KEY,
  part_number     text NOT NULL UNIQUE,
  name            text NOT NULL,
  category_id     int NOT NULL REFERENCES category,
  manufacturer_id int NOT NULL REFERENCES manufacturer,
  condition       part_condition NOT NULL,
  default_price   money_amt NOT NULL CHECK (default_price > 0),   -- req 3: company-wide default
  warranty_months int NOT NULL DEFAULT 0 CHECK (warranty_months >= 0),
  discontinued    boolean NOT NULL DEFAULT false                  -- req 28, 8.6: soft delete
);
CREATE INDEX part_name_idx     ON part (lower(name));             -- req 43
CREATE INDEX part_category_idx ON part (category_id);

CREATE TABLE vehicle (                                            -- 8.3: shared catalog row
  vehicle_id serial PRIMARY KEY,
  year       int NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  make       text NOT NULL,
  model      text NOT NULL,
  engine     text NOT NULL,
  UNIQUE (year, make, model, engine)
);

CREATE TABLE customer_vehicle (                                   -- req 13
  customer_vehicle_id serial PRIMARY KEY,
  customer_id int NOT NULL REFERENCES customer ON DELETE CASCADE,
  vehicle_id  int NOT NULL REFERENCES vehicle,
  nickname    text,
  UNIQUE (customer_id, vehicle_id)
);

CREATE TABLE part_fitment (                                       -- req 30: part <-> vehicle bridge
  part_id    int NOT NULL REFERENCES part,
  vehicle_id int NOT NULL REFERENCES vehicle,
  PRIMARY KEY (part_id, vehicle_id)
);

-- ---------- per-store stock and price ----------
CREATE TABLE inventory (                                          -- req 2, 8.2
  part_id           int NOT NULL REFERENCES part,
  store_id          int NOT NULL REFERENCES store,
  quantity          int NOT NULL DEFAULT 0 CHECK (quantity >= 0), -- 8.5: oversell backstop
  reorder_threshold int NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
  PRIMARY KEY (part_id, store_id)
);

CREATE TABLE store_price (                                        -- req 3
  part_id  int NOT NULL REFERENCES part,
  store_id int NOT NULL REFERENCES store,
  price    money_amt NOT NULL CHECK (price > 0),
  PRIMARY KEY (part_id, store_id)
);

CREATE TABLE inventory_audit (                                    -- req 7, 31
  audit_id    bigserial PRIMARY KEY,
  part_id     int NOT NULL,
  store_id    int NOT NULL,
  employee_id int NOT NULL REFERENCES employee,
  delta       int NOT NULL,
  reason      text NOT NULL CHECK (length(trim(reason)) > 0),
  changed_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (part_id, store_id) REFERENCES inventory
);

-- ---------- suppliers and purchase orders ----------
CREATE TABLE supplier (
  supplier_id serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  phone       text,
  email       text,
  address     text,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE supplier_part (                                      -- req 29
  supplier_id    int NOT NULL REFERENCES supplier,
  part_id        int NOT NULL REFERENCES part,
  cost           money_amt NOT NULL CHECK (cost > 0),
  lead_time_days int NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  PRIMARY KEY (supplier_id, part_id)
);

CREATE TABLE purchase_order (                                     -- req 22, 24
  po_id       serial PRIMARY KEY,
  supplier_id int NOT NULL REFERENCES supplier,
  store_id    int NOT NULL REFERENCES store,                      -- received into one store
  employee_id int NOT NULL REFERENCES employee,
  status      po_status NOT NULL DEFAULT 'draft',
  ordered_on  date NOT NULL DEFAULT current_date,
  expected_on date,
  received_on date,
  CHECK (expected_on IS NULL OR expected_on >= ordered_on),
  CHECK (received_on IS NULL OR received_on >= ordered_on),
  CHECK ((status = 'received') = (received_on IS NOT NULL))
);

CREATE TABLE purchase_order_line (
  po_id     int NOT NULL REFERENCES purchase_order ON DELETE CASCADE,
  part_id   int NOT NULL REFERENCES part,
  quantity  int NOT NULL CHECK (quantity > 0),
  unit_cost money_amt NOT NULL CHECK (unit_cost > 0),
  PRIMARY KEY (po_id, part_id)
);

-- ---------- customer orders ----------
CREATE TABLE customer_order (                                     -- req 36
  order_id     serial PRIMARY KEY,
  customer_id  int NOT NULL REFERENCES customer,
  store_id     int NOT NULL REFERENCES store,                     -- fulfillment store
  employee_id  int REFERENCES employee,                            -- null for self-service web orders
  status       order_status NOT NULL DEFAULT 'placed',
  ordered_at   timestamptz NOT NULL DEFAULT now(),
  promised_on  date,
  delivered_on date,
  tax_amount   money_amt NOT NULL DEFAULT 0,
  CHECK (promised_on IS NULL OR promised_on >= ordered_at::date),
  CHECK (delivered_on IS NULL OR delivered_on >= ordered_at::date),
  CHECK ((status = 'delivered') = (delivered_on IS NOT NULL))
);
CREATE INDEX customer_order_history_idx ON customer_order (customer_id, ordered_at DESC);  -- req 16

CREATE TABLE customer_order_line (
  order_line_id bigserial PRIMARY KEY,
  order_id      int NOT NULL REFERENCES customer_order ON DELETE CASCADE,
  part_id       int NOT NULL REFERENCES part,
  quantity      int NOT NULL CHECK (quantity > 0),
  unit_price    money_amt NOT NULL CHECK (unit_price > 0),         -- 8.6: price at time of sale
  UNIQUE (order_id, part_id)
);

CREATE TABLE payment (                                             -- req 15, 8.4: no card numbers, ever
  payment_id      serial PRIMARY KEY,
  order_id        int NOT NULL REFERENCES customer_order,
  amount          money_amt NOT NULL CHECK (amount > 0),
  card_brand      text NOT NULL,
  card_last4      char(4) NOT NULL CHECK (card_last4 ~ '^[0-9]{4}$'),
  provider_token  text NOT NULL,
  billing_address text NOT NULL,
  paid_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE delivery (                                            -- req 36
  order_id int PRIMARY KEY REFERENCES customer_order ON DELETE CASCADE,
  method   delivery_method NOT NULL,
  cost     money_amt NOT NULL DEFAULT 0,
  address  text,
  CHECK (method = 'pickup' OR address IS NOT NULL)
);

CREATE TABLE part_return (                                         -- req 18, 26
  return_id     serial PRIMARY KEY,
  order_line_id bigint NOT NULL REFERENCES customer_order_line,
  quantity      int NOT NULL CHECK (quantity > 0),
  reason        text NOT NULL,
  refund_amount money_amt NOT NULL,
  employee_id   int REFERENCES employee,
  returned_at   timestamptz NOT NULL DEFAULT now()
);
