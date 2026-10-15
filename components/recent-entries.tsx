import Link from "next/link";
import { db } from "@/lib/db";
import { money, when } from "@/lib/common";
import { UndoButton } from "@/components/undo-button";

type Row = { id: number; kind: "in" | "sale"; created_at: string; items: number; total: number; names: string };

/** The last few entries with Undo, so a mistake can be fixed right after it's made. */
export function RecentEntries() {
  const rows = db()
    .prepare(
      `SELECT e.id, e.kind, e.created_at, COUNT(*) AS items,
              SUM(ABS(m.qty) * m.unit_price) AS total, group_concat(p.name, ', ') AS names
       FROM entries e
       JOIN movements m ON m.entry_id = e.id
       JOIN products p ON p.id = m.product_id
       GROUP BY e.id
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 5`,
    )
    .all() as Row[];

  if (rows.length === 0) return null;

  return (
    <section className="pt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">Recent</h2>
        <Link href="/history" className="text-sm text-emerald-700">
          See all
        </Link>
      </div>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5 pr-2 pl-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.kind === "in" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {r.kind === "in" ? "Stock in" : "Sale"}
                </span>
                <span className="font-medium">{money(r.total)}</span>
                <span className="text-stone-500">{when(r.created_at)}</span>
              </p>
              <p className="mt-0.5 truncate text-sm text-stone-500">{r.names}</p>
            </div>
            <UndoButton id={r.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
