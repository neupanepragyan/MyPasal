// Shared by server and client code. Keep it free of server-only imports.

export const UNITS = ["pcs", "kg", "g", "L", "ml", "pack", "dozen"] as const;
export type Unit = (typeof UNITS)[number];

export type Kind = "in" | "sale";

/** One editable row on the review screen. */
export type Line = {
  productId: number | null; // null = create a new product
  name: string;
  unit: Unit;
  qty: number;
  price: number; // per unit: cost paid for "in", selling price for "sale"
  salePrice: number; // only used when stock-in creates a new product
};

/** What the browser needs to know about a product. */
export type ProductOption = {
  id: number;
  name: string;
  unit: Unit;
  cost_price: number;
  sale_price: number;
  stock: number;
};

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function money(n: number) {
  return `Rs ${number.format(n)}`;
}

export function qty(n: number, unit: string) {
  return `${number.format(n)} ${unit}`;
}

/** SQLite stores UTC as "YYYY-MM-DD HH:MM:SS". Shown in the server's TZ. */
export function when(sqliteUtc: string) {
  return new Date(sqliteUtc.replace(" ", "T") + "Z").toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
