import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, Users, ShieldCheck, Landmark, ListChecks, Truck, Bell as BellIcon, Check } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { listAlerts } from "@/server/services/alerts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { markAlertReadAction, markAllAlertsReadAction } from "@/server/actions/alerts";

const CATEGORY_ICON = {
  INVENTORY: Boxes,
  STAFFING: Users,
  COMPLIANCE: ShieldCheck,
  BANKING: Landmark,
  TASK: ListChecks,
  SUPPLIER: Truck,
  SYSTEM: BellIcon,
} as const;

const SEVERITY_TONE = { INFO: "info", WARNING: "warning", CRITICAL: "danger" } as const;

const CATEGORIES = ["INVENTORY", "STAFFING", "COMPLIANCE", "BANKING", "TASK", "SUPPLIER", "SYSTEM"] as const;

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; unread?: string }>;
}) {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  const { category, unread } = await searchParams;
  const unreadOnly = unread === "1";
  const allAlerts = await listAlerts(location.id, unreadOnly);
  const alerts = category ? allAlerts.filter((a) => a.category === category) : allAlerts;
  const unreadCount = allAlerts.filter((a) => !a.isRead).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
          <p className="text-sm text-muted mt-1">
            {location.name} &middot; {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllAlertsReadAction}>
            <input type="hidden" name="locationId" value={location.id} />
            <button className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-surface-hover transition">
              <Check size={14} /> Mark all read
            </button>
          </form>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/alerts${unreadOnly ? "?unread=1" : ""}`}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
            !category
              ? "gradient-brand text-white border-transparent"
              : "border-border text-muted hover:text-foreground"
          )}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/alerts?category=${c}${unreadOnly ? "&unread=1" : ""}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition",
              category === c
                ? "gradient-brand text-white border-transparent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {c.toLowerCase()}
          </Link>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        <Link
          href={`/alerts?${category ? `category=${category}&` : ""}unread=${unreadOnly ? "0" : "1"}`}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
            unreadOnly
              ? "gradient-brand text-white border-transparent"
              : "border-border text-muted hover:text-foreground"
          )}
        >
          Unread only
        </Link>
      </div>

      <Card className="p-0 divide-y divide-border overflow-hidden">
        {alerts.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No alerts to show.</p>
        ) : (
          alerts.map((alert) => {
            const Icon = CATEGORY_ICON[alert.category];
            return (
              <div
                key={alert.id}
                className={cn("flex items-start gap-3 p-4", !alert.isRead && "bg-brand-purple/5")}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    alert.severity === "CRITICAL" && "bg-danger/15 text-danger",
                    alert.severity === "WARNING" && "bg-warning/15 text-warning",
                    alert.severity === "INFO" && "bg-info/15 text-info"
                  )}
                >
                  <Icon size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{alert.title}</span>
                    <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
                    {!alert.isRead ? <Badge tone="brand">New</Badge> : null}
                  </div>
                  <p className="text-sm text-muted mt-0.5">{alert.message}</p>
                  <p className="text-xs text-muted-2 mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
                {!alert.isRead ? (
                  <form action={markAlertReadAction}>
                    <input type="hidden" name="locationId" value={location.id} />
                    <input type="hidden" name="alertId" value={alert.id} />
                    <button className="text-xs text-muted-2 hover:text-foreground whitespace-nowrap">
                      Mark read
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
