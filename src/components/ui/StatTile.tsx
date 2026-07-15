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
    <div className={cn("card-surface rounded-2xl p-5 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
        {icon ? <span className="text-muted-2">{icon}</span> : null}
      </div>
      <span
        className="text-2xl font-semibold text-foreground"
        style={{ fontVariantNumeric: "proportional-nums" }}
      >
        {value}
      </span>
      {delta ? (
        <span
          className={cn(
            "text-xs font-medium",
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
