import { NextRequest, NextResponse } from "next/server";
import { ok } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { sqlFirst, sqlRun } from "@/db/raw";
import { getDb } from "@/db/client";

export async function POST(request: NextRequest) {
  const steps: string[] = [];
  try {
    const body = (await request.json()) as { seedKey?: string };
    const seedKey = body.seedKey;

    if (seedKey !== "crossover-seed-2024") {
      return ok({ message: "Invalid seed key" }, 403);
    }

    const env = getWorkerEnv();
    const db = getDb(env);
    steps.push("got db");

    // ── Helper ─────────────────────────────────────────────────────
    async function hasColumn(table: string, col: string) {
      const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      return rows.results.some((r) => r.name === col);
    }

    // ── Migrate existing users table ──────────────────────────────
    const userCols: [string, string][] = [
      ["role", "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'"],
      ["is_active", "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1"],
      ["full_name", "ALTER TABLE users ADD COLUMN full_name TEXT"],
      ["password_hash", "ALTER TABLE users ADD COLUMN password_hash TEXT"],
      ["updated_at", "ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"],
    ];
    for (const [col, sql] of userCols) {
      if (!(await hasColumn("users", col))) {
        await sqlRun(db, sql, []);
        steps.push("added users." + col);
      }
    }

    // ── Create all other tables if they don't exist ───────────────
    const ddl = [
      `CREATE TABLE IF NOT EXISTS staff_presence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        base_price_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'draft',
        is_banner INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        r2_key TEXT NOT NULL UNIQUE,
        alt_text TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        variant_sku TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        size TEXT,
        color TEXT,
        material TEXT,
        additional_price_cents INTEGER NOT NULL DEFAULT 0,
        stock_qty INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        billing_address_json TEXT,
        shipping_address_json TEXT,
        marketing_opt_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        customer_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        subtotal_cents INTEGER NOT NULL DEFAULT 0,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        shipping_cents INTEGER NOT NULL DEFAULT 0,
        discount_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        placed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fulfilled_at TEXT,
        cancelled_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_id INTEGER,
        variant_id INTEGER,
        product_name_snapshot TEXT NOT NULL,
        variant_title_snapshot TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price_cents INTEGER NOT NULL DEFAULT 0,
        line_total_cents INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS order_customizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_item_id INTEGER NOT NULL,
        customization_type TEXT NOT NULL DEFAULT 'text',
        field_name TEXT NOT NULL,
        field_value TEXT NOT NULL,
        additional_cost_cents INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS order_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        order_item_id INTEGER,
        r2_key TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        uploaded_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS designer_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        designer_user_id TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'assigned',
        due_at TEXT,
        completed_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS order_status_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        changed_by TEXT,
        reason TEXT,
        changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'cash',
        provider_txn_id TEXT UNIQUE,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL UNIQUE,
        order_id TEXT NOT NULL,
        receipt_number TEXT NOT NULL UNIQUE,
        r2_key TEXT UNIQUE,
        issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_to_email TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`
    ];

    for (const sql of ddl) {
      await sqlRun(db, sql, []);
    }
    steps.push("ensured all tables exist");

    // ── Seed admin owner ──────────────────────────────────────────
    const existing = await sqlFirst<{ id: string }>(
      db,
      "SELECT id FROM users WHERE role = 'owner' LIMIT 1",
      []
    );

    if (existing) {
      return ok({ message: "Owner account already exists", id: existing.id, steps });
    }

    const passwordHash = await hashPassword("admin121002");
    steps.push("hashed password");

    // Adapt INSERT to match actual table structure (id is INTEGER, has name+salt columns)
    await sqlRun(
      db,
      `INSERT INTO users (email, password_hash, salt, name, full_name, role, is_active)
       VALUES (?, ?, '', 'admin', 'admin', 'owner', 1)`,
      ["admin@crossover-apparel.com", passwordHash]
    );
    steps.push("inserted owner");

    // ── Seed default categories ────────────────────────────────────
    const catCount = await sqlFirst<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM categories", []);
    if (!catCount || catCount.cnt === 0) {
      await sqlRun(db, "INSERT INTO categories (name, slug, is_active) VALUES ('Jerseys', 'jerseys', 1)", []);
      await sqlRun(db, "INSERT INTO categories (name, slug, is_active) VALUES ('T-shirts', 'tshirts', 1)", []);
      await sqlRun(db, "INSERT INTO categories (name, slug, is_active) VALUES ('Polo Shirts', 'polo-shirts', 1)", []);
      await sqlRun(db, "INSERT INTO categories (name, slug, is_active) VALUES ('Warmers', 'warmers', 1)", []);
      steps.push("seeded categories");
    }

    return ok({ message: "Owner account created", steps });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: { code: "SEED_ERROR", message: msg, steps } },
      { status: 500 }
    );
  }
}
