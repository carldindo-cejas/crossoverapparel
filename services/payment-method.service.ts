import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll, sqlRun, sqlFirst } from "@/db/raw";

async function ensureTable(env: WorkerEnv) {
  const db = getDb(env);
  await sqlRun(
    db,
    `CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Seed default rows if empty
  const count = await sqlFirst<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM payment_methods");
  if (!count || count.cnt === 0) {
    await sqlRun(db, "INSERT INTO payment_methods (name, is_available) VALUES ('Cash on Delivery', 1)");
    await sqlRun(db, "INSERT INTO payment_methods (name, is_available) VALUES ('Instapay', 0)");
    await sqlRun(db, "INSERT INTO payment_methods (name, is_available) VALUES ('Bank Transfer', 0)");
    await sqlRun(db, "INSERT INTO payment_methods (name, is_available) VALUES ('Pay with Bitcoin Lightning', 1)");
  }

  // Ensure Bitcoin Lightning exists for existing databases
  const btcLn = await sqlFirst<{ id: number }>(db, "SELECT id FROM payment_methods WHERE name = 'Pay with Bitcoin Lightning' LIMIT 1");
  if (!btcLn) {
    await sqlRun(db, "INSERT OR IGNORE INTO payment_methods (name, is_available) VALUES ('Pay with Bitcoin Lightning', 1)");
  }
}

export async function listPaymentMethods(env: WorkerEnv) {
  await ensureTable(env);
  const db = getDb(env);
  return sqlAll(db, "SELECT id, name, is_available, created_at, updated_at FROM payment_methods ORDER BY id ASC");
}

export async function updatePaymentMethodStatus(env: WorkerEnv, id: number, isAvailable: boolean) {
  await ensureTable(env);
  const db = getDb(env);
  await sqlRun(
    db,
    "UPDATE payment_methods SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [isAvailable ? 1 : 0, id]
  );
  return { id, isAvailable };
}
