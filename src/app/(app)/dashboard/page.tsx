import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, PackageX, ShieldAlert, Bell } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { getDashboardSummary, getLocationAtAGlance } from "@/server/services/dashboard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { RevenueChart } from "@/components/dashboard/RevenueChart";

const LOCATION_TYPE_LABEL: Record<string, string> = {
  GAS_STATION: "Gas Station",
  TRUCK_STOP: "Truck Stop",
  GROCERY_STORE: "Grocery Store",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatChange(pct: number | null) {
  if (pct === null) return { text: "No prior data", tone: "neutral" as const };
  const tone = pct >= 0 ? ("up" as const) : ("down" as const);
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}% vs prior period`, tone };
}

export default async function DashboardPage() {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  const [summary, glance] = await Promise.all([
    getDashboardSummary(location.id),
    getLocationAtAGlance(location.id),
  ]);

  const weekChange = formatChange(summary.weekToDate.changePct);
  const monthChange = formatChange(summary.monthToDate.changePct);
  const trendChange = formatChange(summary.last7Days.changePct);

  const glanceItems = [
    {
      label: "Low stock items",
      count: glance.lowStockCount,
      href: "/inventory",
      icon: PackageX,
      tone: glance.lowStockCount > 0 ? "warning" : "success",
    },
    {
      label: "Open tasks",
      count: glance.openTaskCount,
      href: "/tasks",
      icon: ClipboardList,
      tone: glance.openTaskCount > 0 ? "info" : "success",
    },
    {
      label: "Compliance overdue",
      count: glance.overdueComplianceCount,
      href: "/compliance",
      icon: ShieldAlert,
      tone: glance.overdueComplianceCount > 0 ? "danger" : "success",
    },
    {
      label: "Unread alerts",
      count: glance.unreadAlertCount,
      href: "/alerts",
      icon: Bell,
      tone: glance.unreadAlertCount > 0 ? "warning" : "success",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{location.name}</h1>
        <p className="text-sm text-muted mt-1">
          {LOCATION_TYPE_LABEL[location.type]}
          {location.city ? ` · ${location.city}, ${location.state}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today's Revenue"
          value={formatCurrency(summary.today.revenue)}
          delta={`${summary.today.transactionCount} transactions`}
        />
        <StatTile
          label="Week to Date"
          value={formatCurrency(summary.weekToDate.revenue)}
          delta={weekChange.text}
          deltaTone={weekChange.tone}
        />
        <StatTile
          label="Month to Date"
          value={formatCurrency(summary.monthToDate.revenue)}
          delta={monthChange.text}
          deltaTone={monthChange.tone}
        />
        <StatTile
          label="Last 7 Days"
          value={formatCurrency(summary.last7Days.revenue)}
          delta={trendChange.text}
          deltaTone={trendChange.tone}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Revenue</CardTitle>
          <span className="text-xs text-muted-2">Last 7 days</span>
        </CardHeader>
        <RevenueChart data={summary.dailySeries.map((d) => ({ label: d.label, revenue: d.revenue }))} />
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
          At a glance
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {glanceItems.map(({ label, count, href, icon: Icon, tone }) => (
            <Link
              key={label}
              href={href}
              className="card-surface rounded-2xl p-4 flex items-center gap-3 hover:bg-surface-hover transition"
            >
              <span
                className={
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                  (tone === "success"
                    ? "bg-success/15 text-success"
                    : tone === "warning"
                      ? "bg-warning/15 text-warning"
                      : tone === "danger"
                        ? "bg-danger/15 text-danger"
                        : "bg-info/15 text-info")
                }
              >
                <Icon size={18} />
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-semibold text-foreground">{count}</span>
                <span className="text-xs text-muted">{label}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
