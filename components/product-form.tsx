"use client";

import { useActionState } from "react";
import { updateProduct } from "@/app/actions";
import { UNITS, type Unit } from "@/lib/common";

type Props = {
  product: { id: number; name: string; unit: Unit; cost_price: number; sale_price: number; low_stock_at: number };
};

const input = "h-11 w-full rounded-xl border border-stone-300 bg-white px-3";

export function ProductForm({ product }: Props) {
  const [error, action, pending] = useActionState(updateProduct.bind(null, product.id), null);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-white p-4">
      <label className="block text-sm font-medium">
        Name
        <input name="name" defaultValue={product.name} required maxLength={80} className={`mt-1 ${input}`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Unit
          <select name="unit" defaultValue={product.unit} className={`mt-1 ${input}`}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Warn when below
          <input name="low_stock_at" type="number" min="0" step="any" inputMode="decimal" defaultValue={product.low_stock_at} className={`mt-1 ${input}`} />
        </label>
        <label className="block text-sm font-medium">
          Cost (Rs)
          <input name="cost_price" type="number" min="0" step="any" inputMode="decimal" defaultValue={product.cost_price} className={`mt-1 ${input}`} />
        </label>
        <label className="block text-sm font-medium">
          Sells for (Rs)
          <input name="sale_price" type="number" min="0" step="any" inputMode="decimal" defaultValue={product.sale_price} className={`mt-1 ${input}`} />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button disabled={pending} className="h-11 w-full rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
