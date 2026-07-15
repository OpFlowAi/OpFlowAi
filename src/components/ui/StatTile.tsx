import { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatTile({
  label,
  value,
  delta,
  deltaTone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-surface rounded-[16px] p-3.5 flex flex-col gap-2 transition hover:-translate-y-0.5 hover:border-border-strong",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</span>
        {icon ? <span className="text-muted-2">{icon}</span> : null}
      </div>
      <span
        className="text-[19px] font-extrabold text-foreground tracking-tight"
        style={{ fontVariantNumeric: "proportional-nums" }}
      >
        {value}
      </span>
      {delta ? (
        <span
          className={cn(
            "text-[11px] font-bold",
            deltaTone === "up" && "text-success",
            deltaTone === "down" && "text-danger",
            deltaTone === "neutral" && "text-muted"
          )}
        >
          {delta}
        </span>
      ) : null}
    </div>
  );
}
