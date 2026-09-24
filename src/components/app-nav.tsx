"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/recherche", label: "Recherche", icon: Search },
  { href: "/prospects", label: "Prospects", icon: Users },
];

export function AppNav({ dueCount }: { dueCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex items-center gap-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const badge = item.href === "/prospects" && dueCount > 0 ? dueCount : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-accent-soft text-accent-deep" : "text-muted hover:bg-paper hover:text-ink",
            )}
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
            {badge && (
              <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white" title={`${badge} relance(s) à faire`}>
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
