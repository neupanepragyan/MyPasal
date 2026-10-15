"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const TABS: { href: string; label: string; icon: IconName; matches: (path: string) => boolean }[] = [
  { href: "/", label: "Record", icon: "record", matches: (p) => p === "/" || p === "/history" },
  { href: "/stock", label: "Stock", icon: "stock", matches: (p) => p === "/stock" || p.startsWith("/products/") },
  { href: "/insights", label: "Insights", icon: "insights", matches: (p) => p === "/insights" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = tab.matches(path);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-xs font-medium ${
                  active ? "text-emerald-700" : "text-stone-500"
                }`}
              >
                <Icon name={tab.icon} className="size-6" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
