"use client";

import { useState, type KeyboardEvent } from "react";
import { money } from "@/lib/common";

type Point = { day: string; value: number };

// Validated with the dataviz palette checker on white: contrast ≥ 3:1, CVD ΔE 8.6.
const UP = "#059669"; // emerald-600
const DOWN = "#dc2626"; // red-600

const W = 360;
const H = 170;
const PAD = { top: 8, right: 4, bottom: 22, left: 40 };
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

const dayLabel = (day: string, weekday = false) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(weekday && { weekday: "short" }),
  });

/** Clean axis ticks (0, 2K, 4K…) covering min..max, always including 0. */
function ticks(min: number, max: number) {
  const span = max - min || 1;
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  // Whole rupees at least, so an all-zero day range doesn't get a 0.5 tick.
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!);
  const out = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) out.push(v);
  if (out.length < 2) out.push(out[0] + step); // all-zero data still needs a scale
  return out;
}

/** A column with a 4px rounded data end and a square foot on the baseline. */
function column(x: number, w: number, base: number, end: number) {
  const r = Math.min(4, w / 2, Math.abs(base - end));
  const side = end < base ? end + r : end - r;
  return `M${x},${base}V${side}Q${x},${end} ${x + r},${end}H${x + w - r}Q${x + w},${end} ${x + w},${side}V${base}Z`;
}

/**
 * Daily columns. "profit" mode draws losses below the baseline in red and
 * labels values as profit/loss. Tap, hover or arrow keys show a day's value.
 */
export function BarChart({ points, mode, label }: { points: Point[]; mode: "revenue" | "profit"; label: string }) {
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  const t = ticks(Math.min(0, ...values), Math.max(0, ...values));
  const lo = t[0];
  const hi = t[t.length - 1];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * plotH;
  const band = plotW / points.length;
  const barW = Math.min(24, band - 2); // 2px surface gap between neighbours
  const base = y(0);

  const describe = (p: Point) =>
    mode === "profit" ? `${money(Math.abs(p.value))} ${p.value < 0 ? "loss" : "profit"}` : money(p.value);

  function onKey(e: KeyboardEvent) {
    const last = points.length - 1;
    const next =
      e.key === "ArrowLeft" ? Math.max(0, (active ?? last) - 1)
      : e.key === "ArrowRight" ? Math.min(last, (active ?? last) + 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  }

  const shown = active === null ? null : points[active];
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div>
      <div className="relative">
        <p
          aria-live="polite"
          className={`pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-stone-900 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow ${
            shown ? "" : "sr-only"
          }`}
          // Clamped so the first and last days' tooltips stay inside the card.
          style={shown ? { left: `${Math.min(84, Math.max(16, ((PAD.left + (active! + 0.5) * band) / W) * 100))}%` } : undefined}
        >
          {shown && (
            <>
              <strong className="block text-sm">{describe(shown)}</strong>
              <span className="text-stone-300">{dayLabel(shown.day, true)}</span>
            </>
          )}
        </p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-pan-y outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-600"
          role="group"
          aria-label={`${label}. Use left and right arrow keys to read each day.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        >
          {t.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? "#d6d3d1" : "#f0eeec"}
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[10px] tabular-nums">
                {compact.format(v)}
              </text>
            </g>
          ))}

          {points.map((p, i) =>
            p.value === 0 ? null : (
              <path
                key={p.day}
                d={column(PAD.left + i * band + (band - barW) / 2, barW, base, y(p.value))}
                fill={p.value < 0 ? DOWN : UP}
                opacity={active === null || active === i ? 1 : 0.45}
              />
            ),
          )}

          {xLabels.map((i) => (
            <text
              key={i}
              x={PAD.left + (i + 0.5) * band}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-stone-500 text-[10px]"
            >
              {dayLabel(points[i].day)}
            </text>
          ))}

          {/* Hit targets: the whole day column, not just the painted bar. */}
          {points.map((p, i) => (
            <rect
              key={p.day}
              x={PAD.left + i * band}
              y={PAD.top}
              width={band}
              height={plotH}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
            />
          ))}
        </svg>
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-stone-500">Show as table</summary>
        <table className="mt-2 w-full tabular-nums">
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-stone-100">
                <td className="py-1 text-stone-500">{dayLabel(p.day, true)}</td>
                <td className="py-1 text-right">{describe(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
