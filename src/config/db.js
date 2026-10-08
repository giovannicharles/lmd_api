import pg from "pg";
import { env } from "./env.js";

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ...(env.databaseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
  process.exit(-1);
});

export function query(text, params) {
  return pool.query(text, params);
}

export default pool;
