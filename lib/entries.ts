import { db, tx } from "./db.ts";
import type { Kind, Line } from "./common.ts";

/** A line points at a product that no longer exists. Safe to show the user. */
export class MissingProductError extends Error {}

type ProductRow = { id: number; cost_price: number };

/**
 * Saves one reviewed entry atomically. Lines without a productId create the
 * product (or reuse one with the same name). Returns the entry id.
 */
export function recordEntry(kind: Kind, source: "photo" | "text", note: string, lines: Line[]): number {
  const d = db();
  const findById = d.prepare("SELECT id, cost_price FROM products WHERE id = ?");
  const findByName = d.prepare("SELECT id, cost_price FROM products WHERE name = ?");
  const insertProduct = d.prepare(
    "INSERT INTO products (name, unit, cost_price, sale_price) VALUES (?, ?, ?, ?) RETURNING id, cost_price",
  );
  const insertMovement = d.prepare(
    "INSERT INTO movements (entry_id, product_id, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)",
  );
  // Latest price wins, so the next entry pre-fills with it.
  const updatePrice = d.prepare(
    kind === "in"
      ? "UPDATE products SET cost_price = ? WHERE id = ?"
      : "UPDATE products SET sale_price = ? WHERE id = ?",
  );

  return tx(() => {
    const entry = d
      .prepare("INSERT INTO entries (kind, source, note) VALUES (?, ?, ?) RETURNING id")
      .get(kind, source, note) as { id: number };

    for (const line of lines) {
      let product: ProductRow;
      if (line.productId !== null) {
        const found = findById.get(line.productId) as ProductRow | undefined;
        if (!found) throw new MissingProductError(`"${line.name}" was deleted. Pick another product.`);
        product = found;
      } else {
        product =
          (findByName.get(line.name) as ProductRow | undefined) ??
          (insertProduct.get(
            line.name,
            line.unit,
            kind === "in" ? line.price : 0,
            kind === "in" ? line.salePrice : line.price,
          ) as ProductRow);
      }
      insertMovement.run(
        entry.id,
        product.id,
        kind === "in" ? line.qty : -line.qty,
        line.price,
        // Profit uses the cost at the time of sale, not today's cost.
        kind === "in" ? line.price : product.cost_price,
      );
      if (line.price > 0) updatePrice.run(line.price, product.id);
    }
    return entry.id;
  });
}
