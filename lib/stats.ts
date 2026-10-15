import { db } from "./db.ts";
import type { ProductOption, Unit } from "./common.ts";

export type ProductStats = {
  id: number;
  name: string;
  unit: Unit;
  cost_price: number;
  sale_price: number;
  low_stock_at: number;
  stock: number;
  sold_30: number;
  revenue_30: number;
  profit_30: number;
  last_sold_at: string | null;
  age_days: number;
};

const RECENT_SALE = "e.kind = 'sale' AND e.created_at >= datetime('now', '-30 days')";

export function productStats(search = ""): ProductStats[] {
  return db()
    .prepare(
      `SELECT p.id, p.name, p.unit, p.cost_price, p.sale_price, p.low_stock_at,
         COALESCE(SUM(m.qty), 0) AS stock,
         COALESCE(SUM(CASE WHEN ${RECENT_SALE} THEN -m.qty END), 0) AS sold_30,
         COALESCE(SUM(CASE WHEN ${RECENT_SALE} THEN -m.qty * m.unit_price END), 0) AS revenue_30,
         COALESCE(SUM(CASE WHEN ${RECENT_SALE} THEN -m.qty * (m.unit_price - m.unit_cost) END), 0) AS profit_30,
         MAX(CASE WHEN e.kind = 'sale' THEN e.created_at END) AS last_sold_at,
         julianday('now') - julianday(p.created_at) AS age_days
       FROM products p
       LEFT JOIN movements m ON m.product_id = p.id
       LEFT JOIN entries e ON e.id = m.entry_id
       WHERE p.name LIKE ?
       GROUP BY p.id
       ORDER BY p.name`,
    )
    .all(`%${search}%`) as ProductStats[];
}

/** Just the fields the review screen needs, so nothing else is sent to the browser. */
export function productOptions(): ProductOption[] {
  return productStats().map(({ id, name, unit, cost_price, sale_price, stock }) => ({
    id,
    name,
    unit,
    cost_price,
    sale_price,
    stock,
  }));
}

/** Average units sold per day, over the last 30 days or the product's age if younger. */
export function dailyRate(p: ProductStats) {
  return p.sold_30 / Math.min(30, Math.max(1, p.age_days));
}

/** Days until stock runs out at the current rate; null if it isn't selling. */
export function daysLeft(p: ProductStats) {
  const rate = dailyRate(p);
  return rate > 0 ? Math.max(0, p.stock) / rate : null;
}

export function isLow(p: ProductStats) {
  return p.stock <= p.low_stock_at;
}

export function insights(rows: ProductStats[]) {
  const reorder = rows
    .filter((p) => isLow(p) || (daysLeft(p) ?? Infinity) < 7)
    .sort((a, b) => (daysLeft(a) ?? Infinity) - (daysLeft(b) ?? Infinity));
  const bestSellers = rows
    .filter((p) => p.sold_30 > 0)
    .sort((a, b) => b.profit_30 - a.profit_30)
    .slice(0, 5);
  // Only call it dead stock once the product has had a fair week to sell.
  const notSelling = rows
    .filter((p) => p.stock > 0 && p.sold_30 === 0 && p.age_days >= 7)
    .sort((a, b) => b.stock * b.cost_price - a.stock * a.cost_price);

  return {
    revenue: rows.reduce((sum, p) => sum + p.revenue_30, 0),
    profit: rows.reduce((sum, p) => sum + p.profit_30, 0),
    stockValue: rows.reduce((sum, p) => sum + Math.max(0, p.stock) * p.cost_price, 0),
    reorder,
    bestSellers,
    notSelling,
  };
}

/** Compact text table for the advisor prompt. */
export function shopDataForAdvisor(rows: ProductStats[]) {
  const header =
    "product | unit | in stock | sold last 30d | profit last 30d (Rs) | days of stock left | order for next 14 days | cost | price";
  const lines = rows.map((p) => {
    const left = daysLeft(p);
    return [
      p.name,
      p.unit,
      round(p.stock),
      round(p.sold_30),
      round(p.profit_30),
      left === null ? "not selling" : round(left),
      Math.ceil(Math.max(0, dailyRate(p) * 14 - Math.max(0, p.stock))),
      p.cost_price,
      p.sale_price,
    ].join(" | ");
  });
  // ponytail: sends the whole catalog; fine for a few hundred products.
  return [header, ...lines].join("\n");
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
