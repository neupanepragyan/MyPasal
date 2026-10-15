import Link from "next/link";
import { money, qty } from "@/lib/common";
import { insights, isLow, productStats } from "@/lib/stats";

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const products = productStats(search);
  const lowCount = products.filter(isLow).length;
  const { stockValue } = insights(productStats());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock</h1>
        <p className="text-stone-500">Worth {money(stockValue)} at cost price.</p>
      </div>
      <form className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search products"
          aria-label="Search products"
          className="h-11 w-full rounded-xl border border-stone-300 bg-white px-4"
        />
      </form>

      {lowCount > 0 && !search && (
        <Link href="/insights" className="block rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          {lowCount} {lowCount === 1 ? "product is" : "products are"} running low. See what to reorder →
        </Link>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center">
          <p className="font-medium">{search ? "No products match." : "No products yet."}</p>
          {!search && (
            <Link href="/" className="mt-3 inline-block rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white">
              Record your first stock
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-sm text-stone-500">{money(p.sale_price)} each</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${
                    p.stock < 0
                      ? "bg-red-100 text-red-700"
                      : isLow(p)
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-100 text-stone-700"
                  }`}
                >
                  {qty(p.stock, p.unit)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
