import { db } from "@/lib/db";
import { money, qty, when } from "@/lib/common";
import { UndoButton } from "@/components/undo-button";

type Row = {
  entry_id: number;
  kind: "in" | "sale";
  source: "photo" | "text";
  note: string;
  created_at: string;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
};

export default function HistoryPage() {
  const rows = db()
    .prepare(
      `SELECT e.id AS entry_id, e.kind, e.source, e.note, e.created_at,
              p.name, p.unit, m.qty, m.unit_price
       FROM (SELECT * FROM entries ORDER BY created_at DESC, id DESC LIMIT 50) e
       JOIN movements m ON m.entry_id = e.id
       JOIN products p ON p.id = m.product_id
       ORDER BY e.created_at DESC, e.id DESC, m.id`,
    )
    .all() as Row[];

  const entries = Map.groupBy(rows, (r) => r.entry_id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">History</h1>
      {entries.size === 0 && <p className="rounded-2xl bg-white p-6 text-center text-stone-500">Nothing recorded yet.</p>}
      {[...entries].map(([id, lines]) => {
        const { kind, source, note, created_at } = lines[0];
        const total = lines.reduce((sum, l) => sum + Math.abs(l.qty) * l.unit_price, 0);
        return (
          <article key={id} className="rounded-2xl bg-white p-4">
            <header className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  kind === "in" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {kind === "in" ? "Stock in" : "Sale"}
                {source === "photo" && " · photo"}
              </span>
              <span className="text-sm text-stone-500">{when(created_at)}</span>
            </header>
            {note && <p className="mt-2 line-clamp-2 text-sm italic text-stone-500">“{note}”</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">
                    {qty(Math.abs(l.qty), l.unit)} {l.name}
                  </span>
                  <span className="shrink-0 text-stone-500">{money(Math.abs(l.qty) * l.unit_price)}</span>
                </li>
              ))}
            </ul>
            <footer className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
              <span className="font-semibold">{money(total)}</span>
              <UndoButton id={id} />
            </footer>
          </article>
        );
      })}
    </div>
  );
}
