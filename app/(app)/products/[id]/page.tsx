import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { money, qty, when, type Unit } from "@/lib/common";
import { ProductForm } from "@/components/product-form";

type Product = {
  id: number;
  name: string;
  unit: Unit;
  cost_price: number;
  sale_price: number;
  low_stock_at: number;
  stock: number;
};

type Movement = { qty: number; unit_price: number; kind: string; created_at: string };

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const product = db()
    .prepare(
      `SELECT p.*, COALESCE((SELECT SUM(qty) FROM movements WHERE product_id = p.id), 0) AS stock
       FROM products p WHERE p.id = ?`,
    )
    .get(id) as Product | undefined;
  if (!product) notFound();

  const movements = db()
    .prepare(
      `SELECT m.qty, m.unit_price, e.kind, e.created_at
       FROM movements m JOIN entries e ON e.id = m.entry_id
       WHERE m.product_id = ? ORDER BY e.created_at DESC, m.id DESC LIMIT 20`,
    )
    .all(id) as Movement[];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4">
        <h1 className="text-lg font-semibold">{product.name}</h1>
        <p className="text-stone-500">In stock: {qty(product.stock, product.unit)}</p>
      </div>

      {/* node:sqlite rows have a null prototype; client props must be plain objects */}
      <ProductForm product={{ ...product }} />

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-semibold">Recent activity</h2>
        {movements.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Nothing yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {movements.map((m, i) => (
              <li key={i} className="flex justify-between py-2">
                <span className="text-stone-500">{when(m.created_at)}</span>
                <span className={m.qty > 0 ? "text-emerald-700" : "text-stone-700"}>
                  {m.qty > 0 ? "+" : "−"}
                  {qty(Math.abs(m.qty), product.unit)} @ {money(m.unit_price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
