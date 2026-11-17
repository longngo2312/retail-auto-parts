import { Pool } from "pg";

// Single shared connection pool. The globalThis cache keeps Next.js dev
// hot-reloads from leaking a new pool on every reload.
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export default pool;
