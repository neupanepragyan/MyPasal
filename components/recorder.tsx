"use client";

import { useState, useTransition, type ReactNode } from "react";
import { parseEntry, saveEntry } from "@/app/actions";
import { UNITS, money, qty, type Kind, type Line, type ProductOption } from "@/lib/common";
import { Icon, type IconName } from "@/components/icons";
import { VoiceInput } from "@/components/voice-input";

// Inputs hold strings so half-typed numbers like "1." survive re-renders.
type Draft = Omit<Line, "qty" | "price" | "salePrice"> & { qty: string; price: string; salePrice: string };

type Tab = "text" | "audio" | "image";
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "text", label: "Text", icon: "text" },
  { id: "audio", label: "Audio", icon: "mic" },
  { id: "image", label: "Image", icon: "camera" },
];

const KINDS: { id: Kind; label: string }[] = [
  { id: "sale", label: "Sale" },
  { id: "in", label: "Stock in" },
];

const box = "h-11 rounded-xl border border-stone-300 bg-white px-3";
const field = `${box} w-full`;

const knownPrice = (p: ProductOption, kind: Kind) => (kind === "in" ? p.cost_price : p.sale_price);

/** The Record screen: capture by text, voice or photo → Gemma → review → save. `children` shows under the form. */
export function Recorder({ products, children }: { products: ProductOption[]; children?: ReactNode }) {
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("sale");
  const [lines, setLines] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [p.id, p]));
  const usePhoto = tab === "image" && photo !== null;
  const canRead = usePhoto || text.trim().length > 0;

  function choosePhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function reset() {
    setText("");
    choosePhoto(null);
    setLines(null);
    setError(null);
  }

  function read() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("text", text);
      if (usePhoto && photo) {
        try {
          form.set("photo", await shrink(photo), "photo.jpg");
        } catch {
          return setError("Couldn't open that photo. Try taking it again.");
        }
      }
      const result = await parseEntry(form);
      if (!result.ok) return setError(result.error);
      setKind(result.kind);
      setLines(result.lines.map(toDraft));
    });
  }

  function save() {
    if (!lines) return;
    setError(null);
    startTransition(async () => {
      const result = await saveEntry({
        kind,
        source: usePhoto ? "photo" : "text",
        note: text,
        lines: lines.map(fromDraft),
      });
      if (!result.ok) return setError(result.error);
      reset();
      const items = `${result.count} ${result.count === 1 ? "item" : "items"}`;
      setNotice(kind === "in" ? `Stock in saved: ${items}.` : `Sale saved: ${items}.`);
    });
  }

  function update(i: number, patch: Partial<Draft>) {
    setLines((ls) => ls && ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function pickProduct(i: number, value: string) {
    const p = value === "new" ? undefined : byId.get(Number(value));
    if (!p) return update(i, { productId: null });
    update(i, { productId: p.id, name: p.name, unit: p.unit, price: String(knownPrice(p, kind)) });
  }

  /** Flipping sale ↔ stock in swaps cost/sale prices, but only where the price was our default, not one the AI read. */
  function switchKind(next: Kind) {
    setLines(
      (ls) =>
        ls &&
        ls.map((l) => {
          const p = l.productId ? byId.get(l.productId) : undefined;
          return p && Number(l.price) === knownPrice(p, kind) ? { ...l, price: String(knownPrice(p, next)) } : l;
        }),
    );
    setKind(next);
  }

  const total = lines?.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0) ?? 0;

  if (lines) {
    return (
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check before saving</h1>
          <p className="text-stone-500">Fix anything Gemma got wrong.</p>
        </div>

        <Segmented label="Type of entry" options={KINDS} value={kind} onChange={switchKind} />

        {usePhoto && preview && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL
          <img src={preview} alt="Your photo" className="max-h-56 w-full rounded-2xl bg-white object-contain" />
        )}

        {lines.map((line, i) => {
          const product = line.productId ? byId.get(line.productId) : undefined;
          const short = kind === "sale" && product && Number(line.qty) > product.stock;
          return (
            <div key={i} className="space-y-3 rounded-2xl bg-white p-4">
              <div className="flex gap-2">
                <select
                  value={line.productId ?? "new"}
                  onChange={(e) => pickProduct(i, e.target.value)}
                  aria-label="Product"
                  className={field}
                >
                  <option value="new">＋ New product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                  aria-label="Remove item"
                  className="h-11 w-11 shrink-0 rounded-xl text-xl text-stone-400 hover:bg-stone-100"
                >
                  ×
                </button>
              </div>

              {line.productId === null && (
                <div className="flex gap-2">
                  <input
                    value={line.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    placeholder="Product name"
                    aria-label="New product name"
                    maxLength={80}
                    className={`${field} min-w-0`}
                  />
                  <select
                    value={line.unit}
                    onChange={(e) => update(i, { unit: e.target.value as Draft["unit"] })}
                    aria-label="Unit"
                    className={`${box} w-24 shrink-0`}
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <NumberField label={`Qty (${line.unit})`} value={line.qty} onChange={(v) => update(i, { qty: v })} />
                <NumberField
                  label={kind === "in" ? "Cost each (Rs)" : "Price each (Rs)"}
                  value={line.price}
                  onChange={(v) => update(i, { price: v })}
                />
                {kind === "in" && line.productId === null && (
                  <NumberField label="Sells for (Rs)" value={line.salePrice} onChange={(v) => update(i, { salePrice: v })} />
                )}
              </div>

              {short && (
                <p className="text-sm text-amber-700">
                  Only {qty(product.stock, product.unit)} in stock. Saving will make it negative, so record the stock that
                  came in too.
                </p>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setLines([...lines, emptyDraft()])}
          className="h-11 w-full rounded-xl border border-stone-300 bg-white font-medium"
        >
          ＋ Add item
        </button>

        <p className="text-right text-lg font-semibold">Total {money(total)}</p>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setLines(null)}
            disabled={pending}
            className="h-12 rounded-xl border border-stone-300 bg-white font-medium"
          >
            Back
          </button>
          <button
            onClick={save}
            disabled={pending || lines.length === 0}
            className="col-span-2 h-12 rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : kind === "in" ? "Save stock in" : "Save sale"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Record</h1>
        <p className="text-stone-500">A sale or new stock. Gemma works out which.</p>
      </div>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-100 px-4 py-3 text-emerald-900">
          {notice}
        </p>
      )}

      <div role="tablist" aria-label="How to record" className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-200 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="record-panel"
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium ${
              tab === t.id ? "bg-white text-emerald-800 shadow-sm" : "text-stone-600"
            }`}
          >
            <Icon name={t.icon} className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div id="record-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-3">
        {tab === "text" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={"e.g. sold 3 Wai Wai and 2 Coke\nor: got 2 cartons Rara (30 each) at Rs 18"}
            aria-label="What happened"
            className="w-full rounded-2xl border border-stone-300 bg-white p-4 text-base"
          />
        )}

        {tab === "audio" && <VoiceInput text={text} setText={setText} />}

        {tab === "image" && (
          <>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL
              <img src={preview} alt="Selected photo" className="max-h-64 w-full rounded-2xl bg-white object-contain" />
            )}
            <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-600 bg-white font-semibold text-emerald-700">
              <Icon name="camera" className="size-5" />
              {photo ? "Change photo" : "Take or choose a photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  choosePhoto(e.target.files?.[0] ?? null);
                  setNotice(null);
                }}
              />
            </label>
            <p className="text-center text-sm text-stone-500">A supplier bill, new stock, or your sales notebook.</p>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Add a note (optional)"
              aria-label="Note"
              className={field}
            />
          </>
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      <button
        onClick={read}
        disabled={pending || !canRead}
        className="h-12 w-full rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Reading…" : "Read with Gemma"}
      </button>
      <button
        onClick={() => {
          setKind("sale");
          setLines([emptyDraft()]);
        }}
        disabled={pending}
        className="w-full py-1 text-sm text-stone-500 underline"
      >
        or enter items by hand
      </button>

      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-200 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-xl py-2.5 text-sm font-semibold ${
            value === o.id ? "bg-white text-emerald-800 shadow-sm" : "text-stone-600"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-stone-500">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${field} text-stone-900`}
      />
    </label>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </p>
  );
}

function toDraft(l: Line): Draft {
  return { ...l, qty: String(l.qty), price: String(l.price), salePrice: l.salePrice ? String(l.salePrice) : "" };
}

function fromDraft(d: Draft): Line {
  return { ...d, qty: Number(d.qty), price: Number(d.price || 0), salePrice: Number(d.salePrice || 0) };
}

function emptyDraft(): Draft {
  return { productId: null, name: "", unit: "pcs", qty: "1", price: "", salePrice: "" };
}

/** Phone photos are 5–12 MB; the model reads a 1600px JPEG just as well. */
async function shrink(file: File): Promise<Blob> {
  const MAX = 1600;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85),
  );
}
