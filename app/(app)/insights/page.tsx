import Link from "next/link";
import { money, qty } from "@/lib/common";
import { dailySales, daysLeft, insights, productStats, type ProductStats } from "@/lib/stats";
import { AskBox } from "@/components/ask-box";
import { BarChart } from "@/components/bar-chart";

export default function InsightsPage() {
  const rows = productStats();
  const { reorder, bestSellers, notSelling } = insights(rows);
  const days = dailySales(30);
  const revenue = days.reduce((sum, d) => sum + d.revenue, 0);
  const profit = days.reduce((sum, d) => sum + d.profit, 0);
  // Not just revenue: a sale at Rs 0 still has a loss worth charting.
  const noSales = days.every((d) => d.revenue === 0 && d.profit === 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Insights</h1>

      <ChartCard title="Revenue" value={money(revenue)} note="last 30 days" empty={noSales}>
        <BarChart label="Daily revenue, last 30 days" mode="revenue" points={days.map((d) => ({ day: d.day, value: d.revenue }))} />
      </ChartCard>

      <ChartCard
        title="Profit or loss"
        value={`${money(Math.abs(profit))} ${profit < 0 ? "loss" : "profit"}`}
        note="last 30 days, after cost of goods"
        empty={noSales}
        legend
      >
        <BarChart label="Daily profit or loss, last 30 days" mode="profit" points={days.map((d) => ({ day: d.day, value: d.profit }))} />
      </ChartCard>

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

function ChartCard({
  title,
  value,
  note,
  empty,
  legend,
  children,
}: {
  title: string;
  value: string;
  note: string;
  empty: boolean;
  legend?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-stone-500">{title}</h2>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-stone-500">{note}</p>
        </div>
        {legend && !empty && (
          <ul className="flex shrink-0 gap-3 pt-1 text-xs text-stone-600">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-emerald-600" /> Profit
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-red-600" /> Loss
            </li>
          </ul>
        )}
      </div>
      <div className="mt-8">
        {empty ? <p className="text-sm text-stone-500">No sales in the last 30 days yet.</p> : children}
      </div>
    </section>
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
