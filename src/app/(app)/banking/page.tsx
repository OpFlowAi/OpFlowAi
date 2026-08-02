import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { Card } from "@/components/ui/Card";

export default async function BankingPage() {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Banking</h1>
        <p className="text-sm text-muted mt-1">{location.name}</p>
      </div>
      <Card className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-purple/15 text-brand-purple">
          <Landmark size={22} />
        </span>
        <div className="max-w-sm">
          <h2 className="text-lg font-bold text-foreground mb-2">Banking is coming soon</h2>
          <p className="text-sm text-muted">
            Read-only balance, transaction, and cash flow visibility via Plaid is on the way. We&apos;ll
            let you know as soon as it&apos;s ready to connect.
          </p>
        </div>
      </Card>
    </div>
  );
}
