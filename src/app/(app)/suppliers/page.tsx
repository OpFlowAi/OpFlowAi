import { redirect } from "next/navigation";
import { Star, Clock } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { listSuppliers } from "@/server/services/suppliers";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const PO_STATUS_TONE = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  ORDERED: "info",
  RECEIVED: "success",
  CANCELLED: "neutral",
} as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function SuppliersPage() {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  const suppliers = await listSuppliers(location.accountId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Suppliers</h1>
        <p className="text-sm text-muted mt-1">{suppliers.length} vendors across your account</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {suppliers.map((supplier) => (
          <Card key={supplier.id}>
            <CardHeader>
              <div>
                <CardTitle>{supplier.name}</CardTitle>
                <p className="text-xs text-muted-2 mt-0.5">{supplier.category ?? "General"}</p>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                <Star size={14} className="fill-warning text-warning" />
                {supplier.rating.toFixed(1)}
              </div>
            </CardHeader>

            <div className="flex flex-wrap gap-4 text-xs text-muted mb-4">
              <span className="flex items-center gap-1.5">
                <Clock size={13} /> {supplier.leadTimeDays} day lead time
              </span>
              {supplier.contactName ? <span>{supplier.contactName}</span> : null}
              {supplier.email ? <span>{supplier.email}</span> : null}
              {supplier.phone ? <span>{supplier.phone}</span> : null}
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-2 uppercase tracking-wide mb-2">
                Recent orders ({supplier._count.purchaseOrders} total)
              </p>
              {supplier.purchaseOrders.length === 0 ? (
                <p className="text-xs text-muted-2">No orders yet</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {supplier.purchaseOrders.map((po) => (
                    <div key={po.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted">{new Date(po.createdAt).toLocaleDateString()}</span>
                      <Badge tone={PO_STATUS_TONE[po.status]}>{po.status.replace("_", " ")}</Badge>
                      <span className="text-foreground font-medium">{formatCurrency(Number(po.totalCost))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
