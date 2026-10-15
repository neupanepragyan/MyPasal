import Link from "next/link";
import { money, qty } from "@/lib/common";
import { daysLeft, insights, productStats, type ProductStats } from "@/lib/stats";
import { AskBox } from "@/components/ask-box";

export default function InsightsPage() {
  const rows = productStats();
  const { revenue, profit, stockValue, reorder, bestSellers, notSelling } = insights(rows);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Insights</h1>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Sales, 30 days" value={money(revenue)} />
        <Stat label="Profit, 30 days" value={money(profit)} />
        <Stat label="Stock value" value={money(stockValue)} />
      </div>

      <AskBox />

      <Section title="Reorder soon" empty="Nothing is running low.">
        {reorder.map((p) => {
          const left = daysLeft(p);
          return (
            <Row key={p.id} product={p}>
              {qty(p.stock, p.unit)} left
              {left !== null && <span className="block text-xs text-stone-500">~{Math.floor(left)} days</span>}
            </Row>
          );
        })}
      </Section>

      <Section title="Best sellers (by profit)" empty="No sales in the last 30 days.">
        {bestSellers.map((p) => (
          <Row key={p.id} product={p}>
            {money(p.profit_30)}
            <span className="block text-xs text-stone-500">{qty(p.sold_30, p.unit)} sold</span>
          </Row>
        ))}
      </Section>

      <Section title="Not selling (30 days)" empty="Everything in stock is selling.">
        {notSelling.map((p) => (
          <Row key={p.id} product={p}>
            {qty(p.stock, p.unit)}
            <span className="block text-xs text-stone-500">{money(p.stock * p.cost_price)} tied up</span>
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="rounded-2xl bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-stone-100">{children}</ul>
      )}
    </section>
  );
}

function Row({ product, children }: { product: ProductStats; children: React.ReactNode }) {
  return (
    <li>
      <Link href={`/products/${product.id}`} className="flex items-center justify-between gap-3 py-2.5">
        <span className="min-w-0 truncate">{product.name}</span>
        <span className="shrink-0 text-right text-sm font-medium">{children}</span>
      </Link>
    </li>
  );
}
