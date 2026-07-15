import { redirect } from "next/navigation";
import { ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { getBankSummary, getCashFlowForecast } from "@/server/services/banking";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { PlaidConnectButton } from "@/components/banking/PlaidConnectButton";
import { CashFlowChart } from "@/components/banking/CashFlowChart";
import { syncBankAction, disconnectBankAction } from "@/server/actions/banking";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function BankingPage() {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");

  const summary = await getBankSummary(location.id);

  if (!summary.connected) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Banking</h1>
          <p className="text-sm text-muted mt-1">{location.name}</p>
        </div>
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="max-w-sm">
            <h2 className="text-lg font-semibold text-foreground mb-2">Connect a bank account</h2>
            <p className="text-sm text-muted">
              OpsFlow AI shows your balance, transactions, and a cash flow forecast read-only via Plaid.
              We never move money - transfers, vendor payments, and deposits always happen in your own
              bank&apos;s app.
            </p>
          </div>
          <PlaidConnectButton locationId={location.id} />
        </Card>
      </div>
    );
  }

  const forecast = await getCashFlowForecast(location.id);
  const totalBalance = summary.accounts.reduce((s, a) => s + a.currentBalance, 0);
  const allTransactions = summary.accounts
    .flatMap((a) => a.recentTransactions.map((t) => ({ ...t, accountName: a.name })))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Banking</h1>
          <p className="text-sm text-muted mt-1">
            {location.name} &middot; Read-only via Plaid &middot; Last synced{" "}
            {summary.accounts[0]?.lastSyncedAt ? new Date(summary.accounts[0].lastSyncedAt).toLocaleString() : "never"}
          </p>
        </div>
        <form action={syncBankAction}>
          <input type="hidden" name="locationId" value={location.id} />
          <button className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-surface-hover transition">
            <RefreshCw size={14} /> Sync now
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total balance" value={formatCurrency(totalBalance)} delta={`${summary.accounts.length} accounts`} />
        {forecast ? (
          <>
            <StatTile
              label="Avg. daily net flow"
              value={formatCurrency(-forecast.avgDailyNetOutflow)}
              deltaTone={forecast.avgDailyNetOutflow <= 0 ? "up" : "down"}
              delta={forecast.avgDailyNetOutflow <= 0 ? "Trending positive" : "Trending negative"}
            />
            <StatTile
              label="30-day projected balance"
              value={formatCurrency(forecast.projection[29].projectedBalance)}
            />
          </>
        ) : null}
      </div>

      {forecast ? (
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Forecast</CardTitle>
            <span className="text-xs text-muted-2">Next 30 days, based on trailing 30-day average</span>
          </CardHeader>
          <CashFlowChart data={forecast.projection} />
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {summary.accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <div>
                <CardTitle>{account.name}</CardTitle>
                <p className="text-xs text-muted-2 mt-0.5">
                  {account.institutionName ?? "Bank"} {account.mask ? `•••• ${account.mask}` : ""}
                </p>
              </div>
              <span className="text-lg font-semibold text-foreground">
                {formatCurrency(account.currentBalance)}
              </span>
            </CardHeader>

            <div className="flex flex-wrap gap-2 mb-4">
              {(["Transfer", "Pay Vendor", "Deposit"] as const).map((action) =>
                account.institutionUrl ? (
                  <a
                    key={action}
                    href={account.institutionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-surface-hover transition"
                  >
                    {action} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span
                    key={action}
                    title="Connect this account's institution to enable deep links"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-2 opacity-60"
                  >
                    {action} <ExternalLink size={12} />
                  </span>
                )
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {account.recentTransactions.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted truncate">{t.merchantName ?? t.name}</span>
                  <span className={t.amount > 0 ? "text-foreground" : "text-success"}>
                    {t.amount > 0 ? "-" : "+"}
                    {formatCurrency(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
            </div>

            <form action={disconnectBankAction} className="mt-4">
              <input type="hidden" name="locationId" value={location.id} />
              <input type="hidden" name="plaidItemId" value={account.plaidItemId} />
              <button className="flex items-center gap-1.5 text-xs text-muted-2 hover:text-danger transition">
                <Unplug size={12} /> Disconnect
              </button>
            </form>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-2">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {allTransactions.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-foreground">
                    {t.merchantName ?? t.name} {t.pending ? <span className="text-muted-2">(pending)</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{t.accountName}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.amount > 0 ? "text-foreground" : "text-success"}`}>
                    {t.amount > 0 ? "-" : "+"}
                    {formatCurrency(Math.abs(t.amount))}
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
