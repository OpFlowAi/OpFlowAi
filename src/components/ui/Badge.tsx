import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "serious" | "danger" | "info" | "brand";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  serious: "bg-serious/15 text-serious",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  brand: "bg-brand-purple/15 text-brand-purple",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-bold",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
