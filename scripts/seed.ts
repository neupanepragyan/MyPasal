// Demo data: 20 products and 30 days of sales, so Insights has something to
// show. Run with `npm run seed` on an empty database.
import { db, tx } from "../lib/db.ts";

// name, unit, cost, price, average sold per day, warn-below level
const PRODUCTS: [string, string, number, number, number, number][] = [
  ["Wai Wai Chicken 75g", "pcs", 18, 25, 14, 20],
  ["Rara Noodles 70g", "pcs", 17, 20, 6, 15],
  ["Coca-Cola 500ml", "pcs", 45, 60, 7, 12],
  ["Real Mango Juice 1L", "pcs", 160, 200, 1.5, 4],
  ["Sugar", "kg", 95, 110, 4, 10],
  ["Basmati Rice", "kg", 130, 150, 5, 15],
  ["Dhara Mustard Oil 1L", "pcs", 290, 330, 1.2, 4],
  ["DDC Milk 500ml", "pack", 52, 55, 12, 10],
  ["Tokla Tea 500g", "pcs", 320, 360, 0.7, 3],
  ["Masoor Dal", "kg", 160, 185, 2, 5],
  ["Eggs", "pcs", 15, 18, 20, 30],
  ["Lux Soap 100g", "pcs", 55, 70, 2, 6],
  ["Colgate 100g", "pcs", 110, 135, 1, 4],
  ["Surf Excel 1kg", "pcs", 240, 280, 0.8, 3],
  ["Parle-G 80g", "pcs", 9, 10, 10, 20],
  ["Nebico Biscuit 100g", "pcs", 20, 25, 4, 10],
  ["Dairy Milk 50g", "pcs", 80, 100, 2, 6],
  ["Salt 1kg", "pcs", 25, 30, 1.5, 5],
  ["Sunflower Oil 1L", "pcs", 250, 285, 0, 4], // never sells: dead stock
  ["Horlicks 500g", "pcs", 480, 550, 0, 2], // never sells: dead stock
];

const DAYS = 30;

// Seeded RNG so every seed gives the same demo.
let state = 42;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function at(daysAgo: number, hourUtc: number) {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setUTCHours(hourUtc, Math.floor(random() * 60), 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

const d = db();
const count = (d.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
if (count > 0) {
  console.error("The database already has products. Delete data/shop.db first to reseed.");
  process.exit(1);
}

const addEntry = d.prepare("INSERT INTO entries (kind, source, note, created_at) VALUES (?, 'text', ?, ?) RETURNING id");
const addMove = d.prepare("INSERT INTO movements (entry_id, product_id, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)");

tx(() => {
  const products = PRODUCTS.map(([name, unit, cost, price, perDay, low]) => {
    const { id } = d
      .prepare(
        "INSERT INTO products (name, unit, cost_price, sale_price, low_stock_at, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
      )
      .get(name, unit, cost, price, low, at(DAYS + 5, 3)) as { id: number };
    return { id, name, unit, cost, price, perDay, stock: 0 };
  });

  function stockIn(items: typeof products, daysAgo: number) {
    const entry = addEntry.get("in", "", at(daysAgo, 14)) as { id: number }; // evening delivery
    for (const p of items) {
      const amount = Math.max(10, Math.round(p.perDay * 14));
      addMove.run(entry.id, p.id, amount, p.cost, p.cost);
      p.stock += amount;
    }
  }

  stockIn(products, DAYS + 1);

  for (let day = DAYS; day >= 1; day--) {
    // Three to six customers' worth of sales notes per day.
    const batches = 3 + Math.floor(random() * 4);
    for (let b = 0; b < batches; b++) {
      const sold = products.flatMap((p) => {
        // Random rounding keeps slow sellers selling now and then.
        const n = Math.floor((p.perDay / batches) * (0.4 + random() * 1.2) + random());
        return n > 0 && p.stock >= n ? [{ p, n }] : [];
      });
      if (sold.length === 0) continue;
      const note = "sold " + sold.map(({ p, n }) => `${n} ${p.unit === "pcs" ? "" : p.unit + " "}${p.name}`).join(", ");
      const entry = addEntry.get("sale", note, at(day, 2 + b * 2)) as { id: number };
      for (const { p, n } of sold) {
        addMove.run(entry.id, p.id, -n, p.price, p.cost);
        p.stock -= n;
      }
    }

    // Restock anything under 3 days of supply, but stop a few days out so
    // the demo has items to reorder.
    const low = products.filter((p) => p.perDay > 0 && p.stock < p.perDay * 3);
    if (day > 3 && low.length > 0) stockIn(low, day);
  }
});

console.log(`Seeded ${PRODUCTS.length} products and ${DAYS} days of sales.`);
