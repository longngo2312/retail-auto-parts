-- Smallest thing that fails if the schema's integrity rules break.
-- Run: psql -v ON_ERROR_STOP=1 -f db/test_constraints.sql
-- Rolls back; leaves the database as it found it.
BEGIN;

-- Helper: run a statement that must be rejected by a constraint.
CREATE OR REPLACE FUNCTION must_fail(stmt text) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN check_violation OR not_null_violation OR foreign_key_violation OR unique_violation THEN
    RETURN;
  END;
  RAISE EXCEPTION 'expected rejection, but succeeded: %', stmt;
END $$ LANGUAGE plpgsql;

-- req 8.5 / inventory quantity >= 0: cannot oversell
SELECT must_fail('UPDATE inventory SET quantity = -1 WHERE part_id = 1 AND store_id = 1');

-- req 36: delivery date cannot precede the order date
SELECT must_fail($$INSERT INTO customer_order (customer_id, store_id, status, ordered_at, delivered_on)
                   VALUES (1, 1, 'delivered', now(), current_date - 1)$$);

-- status and delivered_on must agree
SELECT must_fail($$INSERT INTO customer_order (customer_id, store_id, status) VALUES (1, 1, 'delivered')$$);

-- prices are positive
SELECT must_fail($$INSERT INTO part (part_number, name, category_id, manufacturer_id, condition, default_price)
                   VALUES ('X1', 'Bad', 5, 1, 'new', 0)$$);

-- req 8.4: no full card numbers -- last4 is exactly four digits
SELECT must_fail($$INSERT INTO payment (order_id, amount, card_brand, card_last4, provider_token, billing_address)
                   VALUES (1, 1, 'visa', '42', 'tok', 'addr')$$);

-- req 31: an inventory adjustment needs a reason
SELECT must_fail($$INSERT INTO inventory_audit (part_id, store_id, employee_id, delta, reason)
                   VALUES (1, 1, 1, -1, '   ')$$);

-- req 21: an inactive employee must carry a termination date
SELECT must_fail('UPDATE employee SET active = false WHERE employee_id = 1');

-- the last-unit race: FOR UPDATE + the CHECK together are what make this safe
SELECT quantity FROM inventory WHERE part_id = 1 AND store_id = 1 FOR UPDATE;

\echo 'constraint tests passed'
ROLLBACK;
