import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Stock is never stored as a number on the product. It is the sum of
// movements (+ for stock in, - for sales), so it can't drift, and undoing an
// entry is just deleting it.
const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
    unit         TEXT NOT NULL DEFAULT 'pcs',
    cost_price   REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    sale_price   REAL NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
    low_stock_at REAL NOT NULL DEFAULT 5 CHECK (low_stock_at >= 0),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entries (
    id         INTEGER PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('in', 'sale')),
    source     TEXT NOT NULL CHECK (source IN ('photo', 'text')),
    note       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS movements (
    id         INTEGER PRIMARY KEY,
    entry_id   INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty        REAL NOT NULL CHECK (qty <> 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    unit_cost  REAL NOT NULL CHECK (unit_cost >= 0)
  );

  CREATE INDEX IF NOT EXISTS movements_product ON movements(product_id);
  CREATE INDEX IF NOT EXISTS movements_entry ON movements(entry_id);
  CREATE INDEX IF NOT EXISTS entries_created ON entries(created_at);
`;

function open() {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "shop.db"));
  db.exec(SCHEMA);
  return db;
}

// Opened lazily (the build machine has no data disk) and kept on globalThis
// so dev hot reloads don't leak connections.
const store = globalThis as { shopDb?: DatabaseSync };

export function db() {
  return (store.shopDb ??= open());
}

/** Runs fn inside a transaction. fn must be synchronous. */
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}
