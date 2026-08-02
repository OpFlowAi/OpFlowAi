import { redirect } from "next/navigation";
import { Landmark, FileSpreadsheet, Receipt } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { requireAccountAdmin } from "@/lib/authz";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const COMING_SOON = [
  {
    key: "quickbooks",
    name: "QuickBooks",
    description: "Sync revenue and accounting data",
    icon: Receipt,
    iconTone: "bg-info/15 text-info",
  },
  {
    key: "google-sheets",
    name: "Google Sheets",
    description: "Sync inventory to a spreadsheet",
    icon: FileSpreadsheet,
    iconTone: "bg-success/15 text-success",
  },
  {
    key: "plaid",
    name: "Plaid (Banking)",
    description: "Read-only balance, transactions & cash flow forecast",
    icon: Landmark,
    iconTone: "bg-brand-purple/15 text-brand-purple",
  },
] as const;

export default async function SettingsPage() {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");
  await requireAccountAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Integrations</h1>
        <p className="text-sm text-muted mt-1">{location.name} &middot; Accounting, spreadsheet, and banking connections</p>
      </div>

      {COMING_SOON.map(({ key, name, description, icon: Icon, iconTone }) => (
        <Card key={key}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${iconTone}`}>
                <Icon size={18} />
              </span>
              <div>
                <CardTitle>{name}</CardTitle>
                <p className="text-xs text-muted-2 mt-0.5">{description}</p>
              </div>
            </div>
            <Badge tone="neutral">Coming soon</Badge>
          </CardHeader>
          <p className="text-sm text-muted">
            This integration isn&apos;t available yet - we&apos;ll announce it here once it&apos;s ready to connect.
          </p>
        </Card>
      ))}
    </div>
  );
}
