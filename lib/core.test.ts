// Run with `npm test`. Uses a throwaway database.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "./db.ts";
import { extractEntry } from "./gemma.ts";
import { MissingProductError, recordEntry } from "./entries.ts";
import { dailySales, daysLeft, insights, productStats } from "./stats.ts";

const dir = mkdtempSync(path.join(tmpdir(), "pasal-test-"));
process.env.DATA_DIR = dir; // db() opens lazily, so this lands before first use
after(() => rmSync(dir, { recursive: true, force: true }));

test("extractEntry tolerates prose, fences and sloppy types, and drops unusable items", () => {
  const reply = `Here you go:
\`\`\`json
{"kind":"in","items":[
  {"product_id":"3","name":"Wai Wai","qty":"2","unit":"packet","unit_price":null},
  {"name":"","qty":1},
  {"product_id":null,"name":"Sugar","qty":0,"unit":"kg"},
  {"product_id":null,"name":"Basmati Rice","qty":25,"unit":"kg","unit_price":3250,"line_total":3250}
]}
\`\`\``;
  assert.deepEqual(extractEntry(reply, "sale"), {
    kind: "in",
    items: [
      { product_id: 3, name: "Wai Wai", qty: 2, unit: "pcs", unit_price: null },
      // A printed line total beats the model's own (wrong) division.
      { product_id: null, name: "Basmati Rice", qty: 25, unit: "kg", unit_price: 130 },
    ],
  });
  assert.equal(extractEntry('{"kind":"refund","items":[]}', "sale").kind, "sale", "unknown kind falls back");
  assert.throws(() => extractEntry("Sorry, I can't read that.", "sale"));
});

test("stock, prices and profit follow the movement ledger", () => {
  const line = { unit: "pcs" as const, salePrice: 0 };
  const firstIn = recordEntry("in", "photo", "", [
    { ...line, productId: null, name: "Wai Wai", qty: 30, price: 18, salePrice: 25 },
  ]);
  const id = productStats()[0].id;
  recordEntry("sale", "text", "sold 10 wai wai", [{ ...line, productId: id, name: "Wai Wai", qty: 10, price: 25 }]);
  // Same name, different case: reuses the product and updates its cost.
  recordEntry("in", "text", "", [{ ...line, productId: null, name: "wai wai", qty: 5, price: 20 }]);

  const [p] = productStats();
  assert.equal(productStats().length, 1);
  assert.equal(p.stock, 25);
  assert.equal(p.cost_price, 20);
  assert.equal(p.sale_price, 25);
  assert.equal(p.sold_30, 10);
  assert.equal(p.revenue_30, 250);
  assert.equal(p.profit_30, 70, "profit uses the cost at time of sale (18), not today's (20)");
  assert.equal(daysLeft(p), 2.5); // 25 left, selling 10/day on a product younger than a day

  const summary = insights(productStats());
  assert.deepEqual(summary.reorder.map((r) => r.id), [id]);
  assert.equal(summary.stockValue, 25 * 20);

  const week = dailySales(7);
  assert.equal(week.length, 7);
  assert.deepEqual(week.at(-1), { day: week.at(-1)!.day, revenue: 250, profit: 70 }, "today's sale lands on the last day");
  assert.ok(week.slice(0, -1).every((d) => d.revenue === 0 && d.profit === 0));

  // A bad line rolls back the whole entry.
  const entriesBefore = db().prepare("SELECT COUNT(*) AS n FROM entries").get();
  assert.throws(
    () => recordEntry("sale", "text", "", [{ ...line, productId: 999, name: "Gone", qty: 1, price: 1 }]),
    MissingProductError,
  );
  assert.deepEqual(db().prepare("SELECT COUNT(*) AS n FROM entries").get(), entriesBefore);

  // Undo = delete the entry; its movements cascade away.
  db().prepare("DELETE FROM entries WHERE id = ?").run(firstIn);
  assert.equal(productStats()[0].stock, -5);
});
