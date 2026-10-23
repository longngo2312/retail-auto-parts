-- Sample data. Catalog is generated so req 43 (5,000 parts) can actually be timed.

INSERT INTO store (name, address, phone, hours, tax_rate) VALUES
  ('Denton',      '1200 W Oak St, Denton, TX',    '940-555-0101', 'Mon-Sat 8-7, Sun 10-5', 0.0825),
  ('Lewisville',  '450 S Stemmons Fwy, Lewisville, TX', '972-555-0102', 'Mon-Sat 8-7, Sun 10-5', 0.0825);

INSERT INTO role (name, is_manager) VALUES ('clerk', false), ('manager', true), ('admin', true);

-- password_hash values are bcrypt('demo1234', 12); demo accounts only.
INSERT INTO employee (store_id, role_id, username, password_hash, first_name, last_name, department, hire_date, salary) VALUES
  (1, 2, 'mgr.denton',  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.cPYOMpkzYv1qYdHHGCsFvjbdkHvbBPu', 'Dana',  'Ruiz',   'Management', '2021-03-01', 62000),
  (1, 1, 'clerk.denton','$2b$12$C6UzMDM.H6dfI/f/IKcEe.cPYOMpkzYv1qYdHHGCsFvjbdkHvbBPu', 'Sam',   'Patel',  'Counter',    '2023-06-15', 38000),
  (2, 1, 'clerk.lv',    '$2b$12$C6UzMDM.H6dfI/f/IKcEe.cPYOMpkzYv1qYdHHGCsFvjbdkHvbBPu', 'Alex',  'Chen',   'Counter',    '2024-01-08', 37000);

INSERT INTO customer (username, password_hash, first_name, last_name, email, phone, address, preferred_store_id) VALUES
  ('jdoe', '$2b$12$C6UzMDM.H6dfI/f/IKcEe.cPYOMpkzYv1qYdHHGCsFvjbdkHvbBPu', 'Jordan', 'Doe', 'jdoe@example.com', '940-555-0199', '15 Maple Ave, Denton, TX', 1);

INSERT INTO category (parent_id, name) VALUES
  (NULL, 'Brakes'), (NULL, 'Electrical'), (NULL, 'Engine'), (NULL, 'Suspension');
INSERT INTO category (parent_id, name) VALUES
  (1, 'Pads'), (1, 'Rotors'), (2, 'Alternators'), (2, 'Batteries'), (3, 'Filters'), (4, 'Shocks');

INSERT INTO manufacturer (name) VALUES
  ('Bosch'), ('Denso'), ('Moog'), ('ACDelco'), ('Wagner');

INSERT INTO supplier (name, phone, email, address) VALUES
  ('Gulf Coast Parts Dist.', '713-555-0150', 'orders@gcpd.example', 'Houston, TX'),
  ('Midwest Auto Supply',    '816-555-0160', 'sales@mwas.example',  'Kansas City, MO');

-- 5,000 parts across the leaf categories.
INSERT INTO part (part_number, name, category_id, manufacturer_id, condition, default_price, warranty_months)
SELECT 'P' || lpad(g::text, 6, '0'),
       (ARRAY['Brake Pad Set','Brake Rotor','Alternator','Battery','Oil Filter','Shock Absorber'])[1 + g % 6]
         || ' ' || (ARRAY['Standard','Premium','Heavy Duty'])[1 + g % 3],
       5 + g % 6,
       1 + g % 5,
       CASE WHEN g % 7 = 0 THEN 'rebuilt'::part_condition ELSE 'new'::part_condition END,
       round((19.99 + (g % 400))::numeric, 2),
       (ARRAY[0, 12, 24, 36])[1 + g % 4]
FROM generate_series(1, 5000) g;

-- Vehicles, and a fitment row for every 5th part.
INSERT INTO vehicle (year, make, model, engine)
SELECT 2010 + g % 15,
       (ARRAY['Toyota','Ford','Honda','Chevrolet'])[1 + g % 4],
       (ARRAY['Camry','F-150','Civic','Silverado'])[1 + g % 4],
       (ARRAY['2.5L I4','3.5L V6','5.0L V8'])[1 + g % 3]
FROM generate_series(1, 180) g
ON CONFLICT DO NOTHING;

INSERT INTO part_fitment (part_id, vehicle_id)
SELECT p.part_id, v.vehicle_id
FROM part p JOIN vehicle v ON v.vehicle_id = 1 + (p.part_id % (SELECT count(*) FROM vehicle))
WHERE p.part_id % 5 = 0
ON CONFLICT DO NOTHING;

INSERT INTO customer_vehicle (customer_id, vehicle_id, nickname) VALUES (1, 1, 'daily driver');

-- Stock every part at both stores; a few below threshold so req 27/33 has something to flag.
INSERT INTO inventory (part_id, store_id, quantity, reorder_threshold)
SELECT p.part_id, s.store_id, (p.part_id * s.store_id) % 25, 5
FROM part p CROSS JOIN store s;

-- Lewisville charges 5% more on a slice of the catalog (req 3).
INSERT INTO store_price (part_id, store_id, price)
SELECT part_id, 2, round(default_price * 1.05, 2) FROM part WHERE part_id % 10 = 0;

INSERT INTO supplier_part (supplier_id, part_id, cost, lead_time_days)
SELECT 1 + part_id % 2, part_id, round(default_price * 0.6, 2), 3 + part_id % 5 FROM part;

-- One delivered order so the reports and order history have a row.
INSERT INTO customer_order (customer_id, store_id, employee_id, status, ordered_at, promised_on, delivered_on, tax_amount)
VALUES (1, 1, 2, 'delivered', now() - interval '10 days', current_date - 7, current_date - 6, 4.13);
INSERT INTO customer_order_line (order_id, part_id, quantity, unit_price) VALUES (1, 1, 1, 20.99), (1, 2, 2, 15.00);
INSERT INTO delivery (order_id, method, cost, address) VALUES (1, 'ship', 9.99, '15 Maple Ave, Denton, TX');
INSERT INTO payment (order_id, amount, card_brand, card_last4, provider_token, billing_address)
VALUES (1, 65.11, 'visa', '4242', 'tok_test_placeholder', '15 Maple Ave, Denton, TX');
