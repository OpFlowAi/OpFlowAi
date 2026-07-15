import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveLocation } from "@/lib/active-location";
import {
  listCategories,
  listInventory,
  getReorderQueue,
  runReorderScan,
} from "@/server/services/inventory";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  reorderItemAction,
  runReorderScanAction,
  decidePurchaseOrderAction,
  receivePurchaseOrderAction,
  setReorderModeAction,
} from "@/server/actions/inventory";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

const STATUS_TONE = { OK: "success", LOW: "warning", CRITICAL: "danger" } as const;

const PO_STATUS_TONE = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  ORDERED: "info",
  RECEIVED: "success",
  CANCELLED: "neutral",
} as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  // Best-effort background-style scan so the reorder queue stays current.
  await runReorderScan(location.id).catch(() => undefined);

  const { category } = await searchParams;
  const [categories, items, queue] = await Promise.all([
    listCategories(location.accountId),
    listInventory(location.id, category),
    getReorderQueue(location.id),
  ]);

  const lowOrCriticalCount = items.filter((i) => i.status !== "OK").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
          <p className="text-sm text-muted mt-1">
            {location.name} &middot; {items.length} items &middot;{" "}
            <span className={lowOrCriticalCount > 0 ? "text-warning" : "text-success"}>
              {lowOrCriticalCount} need attention
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border bg-surface-2 p-1 text-xs">
            <form action={setReorderModeAction}>
              <input type="hidden" name="locationId" value={location.id} />
              <input type="hidden" name="mode" value="DRAFT_APPROVAL" />
              <button
                className={cn(
                  "rounded-lg px-3 py-1.5 font-medium transition",
                  location.reorderApprovalMode === "DRAFT_APPROVAL"
                    ? "gradient-brand text-white"
                    : "text-muted hover:text-foreground"
                )}
              >
                Draft &amp; Approve
              </button>
            </form>
            <form action={setReorderModeAction}>
              <input type="hidden" name="locationId" value={location.id} />
              <input type="hidden" name="mode" value="AUTOMATIC" />
              <button
                className={cn(
                  "rounded-lg px-3 py-1.5 font-medium transition",
                  location.reorderApprovalMode === "AUTOMATIC"
                    ? "gradient-brand text-white"
                    : "text-muted hover:text-foreground"
                )}
              >
                Automatic
              </button>
            </form>
          </div>
          <form action={runReorderScanAction}>
            <input type="hidden" name="locationId" value={location.id} />
            <button className="rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-surface-hover transition">
              Run reorder check
            </button>
          </form>
        </div>
      </div>

      {queue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Reorder Queue</CardTitle>
            <span className="text-xs text-muted-2">
              {location.reorderApprovalMode === "AUTOMATIC"
                ? "Automatic mode - orders are placed immediately"
                : "Draft & approve mode - review before ordering"}
            </span>
          </CardHeader>
          <div className="flex flex-col gap-3">
            {queue.map((po) => (
              <div
                key={po.id}
                className="rounded-xl border border-border bg-surface-2 p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{po.supplier.name}</span>
                    <Badge tone={PO_STATUS_TONE[po.status]}>{po.status.replace("_", " ")}</Badge>
                    <Badge tone="neutral">{po.source === "AUTO_REORDER" ? "Auto-reorder" : "Manual"}</Badge>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(Number(po.totalCost))}
                  </span>
                </div>
                <ul className="text-xs text-muted flex flex-col gap-1">
                  {po.items.map((i) => (
                    <li key={i.id}>
                      {i.inventoryItem.name} &times; {Number(i.quantity)} {i.inventoryItem.unit}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  {po.status === "PENDING_APPROVAL" ? (
                    <>
                      <form action={decidePurchaseOrderAction}>
                        <input type="hidden" name="locationId" value={location.id} />
                        <input type="hidden" name="poId" value={po.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button className="rounded-lg gradient-brand text-white text-xs font-medium px-3 py-1.5">
                          Approve &amp; order
                        </button>
                      </form>
                      <form action={decidePurchaseOrderAction}>
                        <input type="hidden" name="locationId" value={location.id} />
                        <input type="hidden" name="poId" value={po.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button className="rounded-lg border border-border text-xs font-medium px-3 py-1.5 text-muted hover:text-danger hover:border-danger/40">
                          Reject
                        </button>
                      </form>
                    </>
                  ) : (
                    <form action={receivePurchaseOrderAction}>
                      <input type="hidden" name="locationId" value={location.id} />
                      <input type="hidden" name="poId" value={po.id} />
                      <button className="rounded-lg border border-border text-xs font-medium px-3 py-1.5 text-muted hover:text-success hover:border-success/40">
                        Mark received
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/inventory"
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
            !category
              ? "gradient-brand text-white border-transparent"
              : "border-border text-muted hover:text-foreground"
          )}
        >
          All categories
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/inventory?category=${c.id}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              category === c.id
                ? "gradient-brand text-white border-transparent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-2">
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Unit Cost</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-2">{item.sku ?? "No SKU"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{item.category.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 w-32">
                      <span className="text-xs text-muted">
                        {item.currentStock} / {item.parLevel} {item.unit}
                      </span>
                      <div className="h-1.5 w-full rounded-full bg-surface-2">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            item.status === "OK" && "bg-success",
                            item.status === "LOW" && "bg-warning",
                            item.status === "CRITICAL" && "bg-danger"
                          )}
                          style={{ width: `${Math.max(4, item.stockPct)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{item.preferredSupplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatCurrency(item.unitCost)}</td>
                  <td className="px-4 py-3 text-right">
                    {item.status !== "OK" && item.preferredSupplierId ? (
                      <form action={reorderItemAction}>
                        <input type="hidden" name="locationId" value={location.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button className="rounded-lg border border-brand-purple/40 bg-brand-purple/10 px-3 py-1.5 text-xs font-medium text-brand-purple hover:bg-brand-purple/20">
                          Reorder
                        </button>
                      </form>
                    ) : null}
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
