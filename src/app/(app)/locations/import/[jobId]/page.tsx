import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { requireAccountAdmin } from "@/lib/authz";
import { getImportJob, getImportRows } from "@/server/services/bulk-import";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { validateBatchAction, commitBatchAction } from "@/server/actions/bulk-import";

const ROW_STATUS_TONE = { PENDING: "neutral", VALID: "success", INVALID: "danger", IMPORTED: "brand" } as const;

export default async function BulkImportJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const session = await requireAccountAdmin();
  const accountId = session.user.accountId!;
  const job = await getImportJob(jobId, accountId);

  const nextValidateFrom = job.validatedThru + 1;
  const nextValidateTo = Math.min(job.validatedThru + job.batchSize, job.totalRows);
  const nextCommitFrom = job.importedThru + 1;
  const nextCommitTo = Math.min(job.importedThru + job.batchSize, job.totalRows);

  const readyToCommit = job.status !== "COMPLETED" && job.validatedThru >= nextCommitTo && job.importedThru < job.validatedThru;
  const readyToValidate = job.status !== "COMPLETED" && !readyToCommit && job.validatedThru < job.totalRows;

  let previewRows: Awaited<ReturnType<typeof getImportRows>> = [];
  if (readyToCommit) {
    previewRows = await getImportRows(jobId, accountId, { from: nextCommitFrom, to: nextCommitTo });
  } else if (job.status === "COMPLETED") {
    previewRows = await getImportRows(jobId, accountId, { from: Math.max(1, job.totalRows - 99), to: job.totalRows });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/locations/import" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground mb-2">
          <ArrowLeft size={13} /> Back to imports
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{job.fileName}</h1>
          <Badge tone={job.status === "COMPLETED" ? "success" : "info"}>{job.status}</Badge>
        </div>
        <p className="text-sm text-muted mt-1">{job.totalRows} rows total</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatTile label="Imported" value={String(job.importedCount)} />
        <StatTile label="Valid, awaiting commit" value={String(job.validCount)} />
        <StatTile label="Invalid" value={String(job.invalidCount)} deltaTone={job.invalidCount > 0 ? "down" : "neutral"} />
        <StatTile label="Not yet validated" value={String(job.pendingCount)} />
      </div>

      {readyToValidate ? (
        <Card>
          <CardHeader>
            <CardTitle>Validate rows {nextValidateFrom}-{nextValidateTo}</CardTitle>
          </CardHeader>
          <p className="text-sm text-muted mb-4">
            This is a dry run - it checks each row for required fields and correct formats but does not
            create anything yet.
          </p>
          <form action={validateBatchAction}>
            <input type="hidden" name="jobId" value={job.id} />
            <button className="rounded-xl gradient-brand text-white text-sm font-bold px-4 py-2">
              Validate next batch
            </button>
          </form>
        </Card>
      ) : null}

      {readyToCommit ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Review rows {nextCommitFrom}-{nextCommitTo}
            </CardTitle>
            <form action={commitBatchAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <button className="rounded-xl gradient-brand text-white text-sm font-bold px-4 py-2">
                Commit this batch
              </button>
            </form>
          </CardHeader>
          <p className="text-xs text-muted-2 mb-3">
            Valid rows below will be created as locations when you commit. Invalid rows are skipped and
            stay invalid - fix them in your source sheet and re-upload separately if needed.
          </p>
          <PreviewTable rows={previewRows} />
        </Card>
      ) : null}

      {job.status === "COMPLETED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
          </CardHeader>
          <p className="text-sm text-muted mb-3">
            {job.importedCount} location{job.importedCount === 1 ? "" : "s"} created, {job.invalidCount} row
            {job.invalidCount === 1 ? "" : "s"} skipped as invalid.
          </p>
          <PreviewTable rows={previewRows} />
        </Card>
      ) : null}
    </div>
  );
}

function PreviewTable({ rows }: { rows: Awaited<ReturnType<typeof getImportRows>> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-2">
            <th className="px-3 py-2 font-medium">Row</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Name / Type</th>
            <th className="px-3 py-2 font-medium">Address</th>
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const data = row.data as Record<string, string>;
            const errors = (row.errors as string[] | null) ?? [];
            return (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-muted-2">{row.rowNumber}</td>
                <td className="px-3 py-2">
                  <Badge tone={ROW_STATUS_TONE[row.status]}>{row.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="text-foreground font-medium">{data["Location Name"]}</div>
                  <div className="text-xs text-muted-2">{data["Location Type"]}</div>
                </td>
                <td className="px-3 py-2 text-muted">
                  {data["Address Line 1"]}, {data["City"]}, {data["State"]} {data["ZIP Code"]}
                </td>
                <td className="px-3 py-2 text-muted">
                  {data["Contact Name"]}
                  <div className="text-xs text-muted-2">{data["Contact Email"]}</div>
                </td>
                <td className="px-3 py-2">
                  {row.status === "INVALID" ? (
                    <ul className="flex flex-col gap-0.5">
                      {errors.map((e, i) => (
                        <li key={i} className="flex items-start gap-1 text-xs text-danger">
                          <XCircle size={11} className="mt-0.5 shrink-0" /> {e}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 size={11} /> Looks good
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
