"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, LogOut } from "lucide-react";
import { LocationSwitcher } from "@/components/shell/LocationSwitcher";

export function Topbar({
  userName,
  unreadAlertCount,
}: {
  userName: string;
  unreadAlertCount: number;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/60 px-4 py-3 md:px-6">
      <LocationSwitcher />

      <div className="flex items-center gap-3">
        <Link
          href="/alerts"
          className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-2 hover:bg-surface-hover transition"
        >
          <Bell size={16} />
          {unreadAlertCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadAlertCount > 9 ? "9+" : unreadAlertCount}
            </span>
          ) : null}
        </Link>

        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-sm">
          <span className="grid h-6 w-6 place-items-center rounded-full gradient-brand text-[11px] font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </span>
          <span className="text-foreground font-medium">{userName}</span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-2 hover:bg-danger/15 hover:text-danger transition"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
