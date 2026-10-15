import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { z } from "zod";
import { UNITS, type Kind } from "./common.ts";

const MODEL = process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it";

let client: GoogleGenAI | undefined;
function ai() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  // One retry covers the API's occasional 429/5xx blips.
  return (client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 45_000, retryOptions: { attempts: 2 } } }));
}

async function generate(systemInstruction: string, parts: Part[]) {
  try {
    return await generateOnce(systemInstruction, parts);
  } catch (err) {
    // fetch throws TypeError when the connection drops (shop internet); the
    // SDK's own retry only covers HTTP error codes. Try once more.
    if (!(err instanceof TypeError)) throw err;
    return generateOnce(systemInstruction, parts);
  }
}

async function generateOnce(systemInstruction: string, parts: Part[]) {
  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction,
      temperature: 0.2,
      // Measured: ~2s vs ~19s with default thinking, same answers on our prompts.
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    },
  });
  return response.text ?? "";
}

// Model output is untrusted: coerce what we can, drop items we can't use.
const Item = z.object({
  product_id: z.coerce.number().int().positive().nullable().catch(null),
  name: z.string().trim().min(1).max(80),
  qty: z.coerce.number().positive().finite(),
  unit: z.enum(UNITS).catch("pcs"),
  unit_price: z.coerce.number().nonnegative().finite().nullable().catch(null),
  line_total: z.coerce.number().positive().finite().nullable().catch(null),
}).transform(({ line_total, ...item }) => ({
  ...item,
  // The model is unreliable at division; derive the unit price from the printed line total when there is one.
  unit_price: line_total ? Math.round((line_total / item.qty) * 100) / 100 : item.unit_price,
}));
export type ParsedItem = z.output<typeof Item>;

/** Pulls the JSON object out of a reply that may be wrapped in prose or ``` fences. */
export function extractItems(reply: string): ParsedItem[] {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON in model reply");
  const raw = JSON.parse(reply.slice(start, end + 1)) as { items?: unknown };
  if (!Array.isArray(raw.items)) throw new Error("Model reply has no items array");
  return raw.items.flatMap((item) => {
    const parsed = Item.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const KIND_CONTEXT: Record<Kind, string> = {
  in: "This is stock that ARRIVED at the shop (a delivery or supplier bill). Prices are what the shop PAID per unit.",
  sale: "These are items the shop SOLD to customers. Prices are SELLING prices per unit.",
};

type CatalogEntry = { id: number; name: string; unit: string };

export async function parseStock(
  kind: Kind,
  input: { text: string; image?: { mimeType: string; data: string } },
  catalog: CatalogEntry[],
): Promise<ParsedItem[]> {
  const system = `You turn a small shop's notes into structured data. The shop is in Nepal and prices are in Nepalese rupees (Rs).
Input may be a photo (of products, a bill, or a handwritten list) and/or text in English, Nepali, Hindi or a mix. Text is often voice-typed, so expect misspellings.

${KIND_CONTEXT[kind]}

Reply with ONLY a JSON object, no other text, in exactly this shape:
{"items":[{"product_id":number|null,"name":string,"qty":number,"unit":${UNITS.map((u) => `"${u}"`).join("|")},"unit_price":number|null,"line_total":number|null}]}

Rules:
- One item per distinct product.
- If an item is clearly a product from the catalog below, use its id, name and unit. Otherwise product_id is null, and name is a short clear product name with brand and size (e.g. "Wai Wai Chicken 75g").
- qty is in single units of the item's unit. When a bill counts boxes, cartons, bags or sacks of a known size, convert: "2 ctn (30 each)" = 60 pcs, "1 bag rice 25kg" = 25 kg.
- line_total is the amount for the whole line exactly as written (e.g. 1080), or null if none.
- unit_price is the price of ONE unit if stated, or null.
- Ignore anything that is not a product: totals, tax, discounts, shop names, dates, phone numbers.
- If nothing is recognisable, return {"items":[]}.

Catalog (id | name | unit):
${catalog.map((p) => `${p.id} | ${p.name} | ${p.unit}`).join("\n") || "(empty)"}`;

  const parts: Part[] = [];
  if (input.image) parts.push({ inlineData: input.image });
  parts.push({ text: input.text || "Read the items in this photo." });

  return extractItems(await generate(system, parts));
}

export async function advise(question: string, shopData: string) {
  const system = `You advise the owner of a small shop in Nepal on what to stock. Prices are in Nepalese rupees (Rs).
Answer only the question asked; don't add reorder advice unless it was asked for.
Base every point on the shop data provided. For quantities to order, use the "order for next 14 days" column; never invent stock levels.
You may suggest new products that go well with what sells, but label them as suggestions.
Answer in the language of the question. At most 8 lines, each "- Product: what to do (reason with numbers)". Plain text only, no headings, no bold.`;
  return generate(system, [{ text: `Shop data:\n${shopData}\n\nQuestion: ${question}` }]);
}
