"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Stock" },
  { href: "/in", label: "Stock in" },
  { href: "/sales", label: "Sales" },
  { href: "/insights", label: "Insights" },
  { href: "/history", label: "History" },
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? path === "/" || path.startsWith("/products/") : path === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`block py-4 text-center text-sm font-medium ${
                  active ? "text-emerald-700" : "text-stone-500"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
