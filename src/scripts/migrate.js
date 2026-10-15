import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pool from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "db", "migrations");

export async function applyMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: applied } = await pool.query("SELECT filename FROM schema_migrations");
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  SKIP  ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`  OK    ${file}`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  console.log("Migrations complete.");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  applyMigrations()
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
