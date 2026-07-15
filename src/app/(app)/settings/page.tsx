import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, Landmark, FileSpreadsheet, Receipt } from "lucide-react";
import { getActiveLocation } from "@/lib/active-location";
import { requireAccountAdmin } from "@/lib/authz";
import {
  getIntegrationsStatus,
  isQuickBooksConfigured,
  isGoogleConfigured,
} from "@/server/services/integrations";
import { getBankSummary } from "@/server/services/banking";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  disconnectIntegrationAction,
  syncQuickBooksAction,
  setGoogleSheetAction,
  syncGoogleSheetAction,
} from "@/server/actions/integrations";

const ERROR_MESSAGES: Record<string, string> = {
  quickbooks_not_configured: "QuickBooks isn't configured yet. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET on the server.",
  quickbooks_connect_failed: "Couldn't finish connecting QuickBooks. Please try again.",
  quickbooks_forbidden: "You don't have access to that location.",
  quickbooks_invalid_state: "That QuickBooks connection link expired. Please try again.",
  google_not_configured: "Google Sheets isn't configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.",
  google_connect_failed: "Couldn't finish connecting Google Sheets. Please try again.",
  google_forbidden: "You don't have access to that location.",
  google_invalid_state: "That Google Sheets connection link expired. Please try again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { location } = await getActiveLocation();
  if (!location) redirect("/onboarding");
  await requireAccountAdmin();

  const { error, connected } = await searchParams;
  const [status, bankSummary] = await Promise.all([
    getIntegrationsStatus(location.id),
    getBankSummary(location.id),
  ]);

  const qbConfigured = isQuickBooksConfigured();
  const googleConfigured = isGoogleConfigured();
  const qbMetadata = (status.quickbooks?.metadata as { companyName?: string } | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="text-sm text-muted mt-1">{location.name} &middot; Connect your accounting, spreadsheet, and banking tools</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </div>
      ) : null}
      {connected ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 size={16} /> Connected successfully.
        </div>
      ) : null}

      {/* QuickBooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-info/15 text-info">
              <Receipt size={18} />
            </span>
            <div>
              <CardTitle>QuickBooks</CardTitle>
              <p className="text-xs text-muted-2 mt-0.5">Sync revenue and accounting data</p>
            </div>
          </div>
          <Badge tone={status.quickbooks?.status === "CONNECTED" ? "success" : "neutral"}>
            {status.quickbooks?.status === "CONNECTED" ? "Connected" : "Not connected"}
          </Badge>
        </CardHeader>

        {status.quickbooks?.status === "CONNECTED" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {qbMetadata?.companyName ? `Company: ${qbMetadata.companyName}` : "Connected"}
              {status.quickbooks.lastSyncedAt
                ? ` · Last synced ${new Date(status.quickbooks.lastSyncedAt).toLocaleString()}`
                : ""}
            </p>
            <div className="flex gap-2">
              <form action={syncQuickBooksAction}>
                <input type="hidden" name="locationId" value={location.id} />
                <button className="rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-surface-hover">
                  Sync now
                </button>
              </form>
              <form action={disconnectIntegrationAction}>
                <input type="hidden" name="locationId" value={location.id} />
                <input type="hidden" name="provider" value="QUICKBOOKS" />
                <button className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted hover:text-danger hover:border-danger/40">
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        ) : (
          <a
            href={`/api/integrations/quickbooks/connect?locationId=${location.id}`}
            className="inline-flex items-center gap-2 rounded-xl gradient-brand px-4 py-2 text-sm font-medium text-white"
          >
            Connect QuickBooks <ExternalLink size={14} />
          </a>
        )}
        {!qbConfigured && status.quickbooks?.status !== "CONNECTED" ? (
          <p className="text-xs text-muted-2 mt-2">Requires QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET on the server.</p>
        ) : null}
      </Card>

      {/* Google Sheets */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/15 text-success">
              <FileSpreadsheet size={18} />
            </span>
            <div>
              <CardTitle>Google Sheets</CardTitle>
              <p className="text-xs text-muted-2 mt-0.5">Sync inventory to a spreadsheet</p>
            </div>
          </div>
          <Badge tone={status.googleSheets?.status === "CONNECTED" ? "success" : "neutral"}>
            {status.googleSheets?.status === "CONNECTED" ? "Connected" : "Not connected"}
          </Badge>
        </CardHeader>

        {status.googleSheets?.status === "CONNECTED" ? (
          <div className="flex flex-col gap-3">
            <form action={setGoogleSheetAction} className="flex gap-2">
              <input type="hidden" name="locationId" value={location.id} />
              <input
                name="spreadsheetId"
                defaultValue={status.googleSheets.externalId ?? ""}
                placeholder="Spreadsheet ID (from the sheet's URL)"
                className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
              <button className="rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-surface-hover">
                Save
              </button>
            </form>
            <p className="text-xs text-muted-2">
              {status.googleSheets.lastSyncedAt
                ? `Last synced ${new Date(status.googleSheets.lastSyncedAt).toLocaleString()}`
                : "Not synced yet"}
            </p>
            <div className="flex gap-2">
              <form action={syncGoogleSheetAction}>
                <input type="hidden" name="locationId" value={location.id} />
                <button
                  disabled={!status.googleSheets.externalId}
                  className="rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
                >
                  Sync inventory now
                </button>
              </form>
              <form action={disconnectIntegrationAction}>
                <input type="hidden" name="locationId" value={location.id} />
                <input type="hidden" name="provider" value="GOOGLE_SHEETS" />
                <button className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted hover:text-danger hover:border-danger/40">
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        ) : (
          <a
            href={`/api/integrations/google/connect?locationId=${location.id}`}
            className="inline-flex items-center gap-2 rounded-xl gradient-brand px-4 py-2 text-sm font-medium text-white"
          >
            Connect Google Sheets <ExternalLink size={14} />
          </a>
        )}
        {!googleConfigured && status.googleSheets?.status !== "CONNECTED" ? (
          <p className="text-xs text-muted-2 mt-2">Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on the server.</p>
        ) : null}
      </Card>

      {/* Plaid / Banking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-purple/15 text-brand-purple">
              <Landmark size={18} />
            </span>
            <div>
              <CardTitle>Plaid (Banking)</CardTitle>
              <p className="text-xs text-muted-2 mt-0.5">Read-only balance, transactions & cash flow forecast</p>
            </div>
          </div>
          <Badge tone={bankSummary.connected ? "success" : "neutral"}>
            {bankSummary.connected ? `${bankSummary.accounts.length} account(s)` : "Not connected"}
          </Badge>
        </CardHeader>
        <Link
          href="/banking"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-hover"
        >
          Manage in Banking <ExternalLink size={14} />
        </Link>
      </Card>
    </div>
  );
}
