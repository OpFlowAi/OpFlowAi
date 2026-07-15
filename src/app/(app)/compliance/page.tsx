import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { getComplianceOverview } from "@/server/services/compliance";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { completeComplianceItemAction } from "@/server/actions/compliance";

const STATUS_TONE = { OVERDUE: "danger", DUE_SOON: "warning", UPCOMING: "neutral", COMPLETED: "success" } as const;
const STATUS_LABEL = { OVERDUE: "Overdue", DUE_SOON: "Due soon", UPCOMING: "Upcoming", COMPLETED: "Completed" } as const;

export default async function CompliancePage() {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  const items = await getComplianceOverview(location.id);
  const overdueCount = items.filter((i) => i.status === "OVERDUE").length;
  const dueSoonCount = items.filter((i) => i.status === "DUE_SOON").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
        <p className="text-sm text-muted mt-1">{location.name} &middot; Inspections &amp; certifications</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Overdue" value={String(overdueCount)} deltaTone={overdueCount > 0 ? "down" : "neutral"} />
        <StatTile label="Due soon (7 days)" value={String(dueSoonCount)} deltaTone={dueSoonCount > 0 ? "up" : "neutral"} />
        <StatTile label="Total tracked" value={String(items.length)} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-2">
                <th className="px-4 py-3 font-medium">Checklist item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Frequency</th>
                <th className="px-4 py-3 font-medium">Due date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{item.title}</div>
                    {item.lastCompletedAt ? (
                      <div className="text-xs text-muted-2">
                        Last done {new Date(item.lastCompletedAt).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{item.category}</td>
                  <td className="px-4 py-3 text-muted capitalize">{item.frequency.toLowerCase()}</td>
                  <td className="px-4 py-3 text-muted">{new Date(item.nextDueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <form action={completeComplianceItemAction}>
                        <input type="hidden" name="locationId" value={location.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="passed" value="true" />
                        <button
                          title="Mark complete (passed)"
                          className="grid h-7 w-7 place-items-center rounded-lg border border-success/30 bg-success/10 text-success hover:bg-success/20"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      </form>
                      <form action={completeComplianceItemAction}>
                        <input type="hidden" name="locationId" value={location.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="passed" value="false" />
                        <button
                          title="Mark complete (failed)"
                          className="grid h-7 w-7 place-items-center rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                        >
                          <XCircle size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
