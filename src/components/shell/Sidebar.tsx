"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Sparkles,
  Users,
  Landmark,
  ShieldCheck,
  Truck,
  Bell,
  ListChecks,
  Building2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/agent", label: "AI Agent", icon: Sparkles },
  { href: "/staffing", label: "Staffing", icon: Users },
  { href: "/banking", label: "Banking", icon: Landmark },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
] as const;

const ADMIN_NAV_ITEMS = [
  { href: "/locations", label: "Locations", icon: Building2 },
  { href: "/settings", label: "Integrations", icon: Settings },
] as const;

export function Sidebar({ isAccountAdmin }: { isAccountAdmin: boolean }) {
  const pathname = usePathname();

  const items = isAccountAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5">
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand text-white font-bold text-sm">
          O
        </div>
        <span className="text-base font-semibold gradient-brand-text">OpsFlow AI</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "gradient-brand text-white shadow-lg shadow-indigo-950/30"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pt-4 text-[11px] text-muted-2">
        OpsFlow AI &middot; $500/location/mo
      </div>
    </aside>
  );
}
