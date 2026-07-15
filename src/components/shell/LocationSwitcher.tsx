"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, Check } from "lucide-react";
import { useLocationStore } from "@/store/location-store";
import { cn } from "@/lib/cn";

const TYPE_LABEL: Record<string, string> = {
  GAS_STATION: "Gas Station",
  TRUCK_STOP: "Truck Stop",
  GROCERY_STORE: "Grocery Store",
};

export function LocationSwitcher() {
  const { locations, activeLocationId, setActiveLocationId } = useLocationStore();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const active = locations.find((l) => l.id === activeLocationId);

  async function handleSelect(id: string) {
    if (id === activeLocationId) {
      setOpen(false);
      return;
    }
    setActiveLocationId(id);
    setOpen(false);
    await fetch("/api/session/active-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: id }),
    });
    startTransition(() => {
      router.refresh();
    });
  }

  if (locations.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm hover:bg-surface-hover transition disabled:opacity-60"
      >
        <MapPin size={16} className="text-brand-purple shrink-0" />
        <span className="flex flex-col items-start leading-tight">
          <span className="font-medium text-foreground">{active?.name ?? "Select location"}</span>
          {active ? (
            <span className="text-[11px] text-muted-2">
              {TYPE_LABEL[active.type]}
              {active.city ? ` · ${active.city}, ${active.state}` : ""}
            </span>
          ) : null}
        </span>
        <ChevronDown size={14} className="text-muted-2 ml-1" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xl shadow-black/40">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-2">
              Switch location
            </div>
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleSelect(loc.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-hover transition",
                  loc.id === activeLocationId && "bg-surface-hover"
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{loc.name}</span>
                  <span className="text-[11px] text-muted-2">
                    {TYPE_LABEL[loc.type]}
                    {loc.city ? ` · ${loc.city}, ${loc.state}` : ""}
                  </span>
                </span>
                {loc.id === activeLocationId ? (
                  <Check size={16} className="text-brand-purple shrink-0" />
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
