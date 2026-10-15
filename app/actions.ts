"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { MissingProductError, recordEntry } from "@/lib/entries";
import { UNITS, type Kind, type Line } from "@/lib/common";
import { advise, parseStock } from "@/lib/gemma";
import { productStats, shopDataForAdvisor } from "@/lib/stats";
import {
  SESSION_COOKIE,
  loginLocked,
  pinMatches,
  recordFailedLogin,
  requireAuth,
  sessionToken,
} from "@/lib/auth";

const KindSchema = z.enum(["in", "sale"]);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const AI_ERROR = "Couldn't reach the AI right now. Check the internet and try again.";

// ---------- login ----------

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  if (loginLocked()) return "Too many wrong PINs. Try again in 15 minutes.";
  if (!pinMatches(String(form.get("pin") ?? ""))) {
    recordFailedLogin();
    return "Wrong PIN.";
  }
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: https, // plain http on the shop Wi-Fi can't carry a secure cookie
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- read a photo or text with Gemma ----------

export type ParseResult = { ok: true; lines: Line[] } | { ok: false; error: string };

export async function parseEntry(kind: Kind, form: FormData): Promise<ParseResult> {
  await requireAuth();
  kind = KindSchema.parse(kind);

  const text = String(form.get("text") ?? "").trim().slice(0, 2000);
  const photo = form.get("photo");
  let image: { mimeType: string; data: string } | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) return { ok: false, error: "That file isn't a photo." };
    if (photo.size > MAX_PHOTO_BYTES) return { ok: false, error: "Photo is too large." };
    image = { mimeType: photo.type, data: Buffer.from(await photo.arrayBuffer()).toString("base64") };
  }
  if (!text && !image) return { ok: false, error: "Add a photo or type what happened." };

  const catalog = productStats();
  let items;
  try {
    items = await parseStock(kind, { text, image }, catalog);
  } catch (err) {
    console.error("parseEntry failed", err);
    return { ok: false, error: AI_ERROR };
  }
  if (items.length === 0) {
    return { ok: false, error: "Couldn't find any products in that. Try a clearer photo or more detail." };
  }

  const byId = new Map(catalog.map((p) => [p.id, p]));
  const lines = items.map((item): Line => {
    const product = item.product_id ? byId.get(item.product_id) : undefined;
    const knownPrice = kind === "in" ? product?.cost_price : product?.sale_price;
    return {
      productId: product?.id ?? null,
      name: product?.name ?? item.name,
      unit: product?.unit ?? item.unit,
      qty: item.qty,
      price: item.unit_price ?? knownPrice ?? 0,
      salePrice: 0,
    };
  });
  return { ok: true, lines };
}

// ---------- save a reviewed entry ----------

const LineSchema = z.object({
  productId: z.number().int().positive().nullable(),
  name: z.string().trim().min(1, "Every product needs a name").max(80),
  unit: z.enum(UNITS),
  qty: z.number().positive("Quantity must be more than 0").max(1_000_000),
  price: z.number().nonnegative("Price can't be negative").max(10_000_000),
  salePrice: z.number().nonnegative().max(10_000_000),
});

const EntrySchema = z.object({
  kind: KindSchema,
  source: z.enum(["photo", "text"]),
  note: z.string().trim().max(2000),
  lines: z.array(LineSchema).min(1, "Nothing to save").max(200),
});

export type SaveResult = { ok: true; count: number } | { ok: false; error: string };

export async function saveEntry(input: z.input<typeof EntrySchema>): Promise<SaveResult> {
  await requireAuth();
  const parsed = EntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { kind, source, note, lines } = parsed.data;

  try {
    recordEntry(kind, source, note, lines);
  } catch (err) {
    if (err instanceof MissingProductError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath("/", "layout");
  return { ok: true, count: lines.length };
}

export async function undoEntry(id: number) {
  await requireAuth();
  db().prepare("DELETE FROM entries WHERE id = ?").run(z.number().int().parse(id));
  revalidatePath("/", "layout");
}

// ---------- edit a product ----------

const ProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  unit: z.enum(UNITS),
  cost_price: z.coerce.number().nonnegative("Cost can't be negative"),
  sale_price: z.coerce.number().nonnegative("Price can't be negative"),
  low_stock_at: z.coerce.number().nonnegative("Low-stock level can't be negative"),
});

export async function updateProduct(id: number, _prev: string | null, form: FormData): Promise<string | null> {
  await requireAuth();
  const parsed = ProductSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return parsed.error.issues[0].message;
  const p = parsed.data;
  try {
    db()
      .prepare("UPDATE products SET name = ?, unit = ?, cost_price = ?, sale_price = ?, low_stock_at = ? WHERE id = ?")
      .run(p.name, p.unit, p.cost_price, p.sale_price, p.low_stock_at, z.number().int().parse(id));
  } catch (err) {
    if (String(err).includes("UNIQUE")) return "Another product already has that name.";
    throw err;
  }
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- ask the advisor ----------

export type AskResult = { ok: true; answer: string } | { ok: false; error: string };

export async function ask(question: string): Promise<AskResult> {
  await requireAuth();
  const q = z.string().trim().min(1).max(500).safeParse(question);
  if (!q.success) return { ok: false, error: "Type a question first." };
  const rows = productStats();
  if (rows.length === 0) return { ok: false, error: "Record some stock and sales first." };
  try {
    return { ok: true, answer: (await advise(q.data, shopDataForAdvisor(rows))).trim() };
  } catch (err) {
    console.error("ask failed", err);
    return { ok: false, error: AI_ERROR };
  }
}
