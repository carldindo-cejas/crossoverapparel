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
    const env = getWorkerEnv();

    // Seed key must match a secret stored in Cloudflare (wrangler secret put SEED_KEY)
    const expectedSeedKey = env.SEED_KEY;
    if (!expectedSeedKey || seedKey !== expectedSeedKey) {
      return ok({ message: "Invalid seed key" }, 403);
    }
    const db = getDb(env);
    steps.push("got db");

    // ── Helpers ────────────────────────────────────────────────────
    async function hasColumn(table: string, col: string) {
      const rows = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      return rows.results.some((r) => r.name === col);
    }

    async function tableExists(name: string) {
      const row = await sqlFirst<{ cnt: number }>(
        db,
        "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?",
        [name]
      );
      return (row?.cnt ?? 0) > 0;
    }

    // ── Ensure users table exists with TEXT PRIMARY KEY ───────────
    if (!(await tableExists("users"))) {
      await sqlRun(
        db,
        `CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          full_name TEXT,
          role TEXT NOT NULL DEFAULT 'customer',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        []
      );
      steps.push("created users table");
    } else {
      // Fix: if users.id was created as INTEGER, recreate with TEXT PK
      const cols = await db
        .prepare("PRAGMA table_info(users)")
        .all<{ name: string; type: string; pk: number }>();
      const idCol = cols.results.find((c) => c.name === "id");
      if (idCol && idCol.type.toUpperCase() !== "TEXT") {
        await sqlRun(db, "PRAGMA foreign_keys = OFF", []);
        await sqlRun(
          db,
          `CREATE TABLE users_new (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'customer',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          []
        );
        await sqlRun(
          db,
          `INSERT INTO users_new (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
           SELECT CAST(id AS TEXT), email, password_hash, full_name,
                  COALESCE(role, 'customer'),
                  COALESCE(is_active, 1),
                  COALESCE(created_at, CURRENT_TIMESTAMP),
                  COALESCE(updated_at, CURRENT_TIMESTAMP)
           FROM users`,
          []
        );
        await sqlRun(db, "DROP TABLE users", []);
        await sqlRun(db, "ALTER TABLE users_new RENAME TO users", []);
        await sqlRun(db, "PRAGMA foreign_keys = ON", []);
        steps.push("migrated users.id from INTEGER to TEXT PRIMARY KEY");
      }
    }

    // ── Migrate existing users table columns ──────────────────────
    const userCols: [string, string][] = [
      ["role", "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'"],
      ["is_active", "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1"],
      ["full_name", "ALTER TABLE users ADD COLUMN full_name TEXT"],
      ["password_hash", "ALTER TABLE users ADD COLUMN password_hash TEXT"],
      ["created_at", "ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP"],
      ["updated_at", "ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"],
    ];
    for (const [col, sql] of userCols) {
      if (!(await hasColumn("users", col))) {
        await sqlRun(db, sql, []);
        steps.push("added users." + col);
      }
    }

    // Ensure users indexes
    await sqlRun(db, "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)", []);
    await sqlRun(db, "CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active)", []);

    // ── Migrate orders table ──────────────────────────────────────
    const orderCols: [string, string][] = [
      ["quantity", "ALTER TABLE orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0"],
      ["payment_receipt_r2_key", "ALTER TABLE orders ADD COLUMN payment_receipt_r2_key TEXT"],
    ];
    if (await tableExists("orders")) {
      for (const [col, sql] of orderCols) {
        if (!(await hasColumn("orders", col))) {
          await sqlRun(db, sql, []);
          steps.push("added orders." + col);
        }
      }
      // Migrate refunded → payment_failed
      const refundedCount = (await sqlFirst<{ c: number }>(db, "SELECT COUNT(*) as c FROM orders WHERE status = 'refunded'", []))?.c ?? 0;
      if (refundedCount > 0) {
        await sqlRun(db, "UPDATE orders SET status = 'payment_failed' WHERE status = 'refunded'", []);
        steps.push(`migrated ${refundedCount} orders from refunded to payment_failed`);
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
        currency TEXT NOT NULL DEFAULT 'PHP',
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
        currency TEXT NOT NULL DEFAULT 'PHP',
        quantity INTEGER NOT NULL DEFAULT 0,
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
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        UNIQUE (order_id, designer_user_id)
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
        currency TEXT NOT NULL DEFAULT 'PHP',
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
      )`,
      `CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT,
        is_custom_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_available INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of ddl) {
      await sqlRun(db, sql, []);
    }
    steps.push("ensured all tables exist");

    // ── Migrate currency to PHP ──────────────────────────────────
    await sqlRun(db, "UPDATE products SET currency = 'PHP' WHERE currency = 'USD'", []);
    await sqlRun(db, "UPDATE orders SET currency = 'PHP' WHERE currency = 'USD'", []);
    await sqlRun(db, "UPDATE payments SET currency = 'PHP' WHERE currency = 'USD'", []);
    steps.push("migrated currency to PHP");

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

    // Adapt INSERT to match actual table structure (no salt/name columns)
    const ownerId = crypto.randomUUID();
    await sqlRun(
      db,
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, 'admin', 'owner', 1)`,
      [ownerId, "admin@crossover-apparel.com", passwordHash]
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

    // ── Seed default payment methods ──────────────────────────────
    const pmCount = await sqlFirst<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM payment_methods", []);
    if (!pmCount || pmCount.cnt === 0) {
      await sqlRun(db, "INSERT INTO payment_methods (name, is_available) VALUES ('Cash on Delivery', 1)", []);
      await sqlRun(db, "INSERT INTO payment_methods (name, is_available) VALUES ('Instapay', 0)", []);
      await sqlRun(db, "INSERT INTO payment_methods (name, is_available) VALUES ('Bank Transfer', 0)", []);
      steps.push("seeded payment_methods");
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
