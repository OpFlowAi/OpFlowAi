import Link from "next/link";
import { requireAccountAdmin } from "@/lib/authz";
import { listImportJobs } from "@/server/services/bulk-import";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UploadForm } from "@/components/bulk-import/UploadForm";

const STATUS_TONE = {
  DRAFT: "neutral",
  VALIDATING: "warning",
  READY: "info",
  IMPORTING: "info",
  COMPLETED: "success",
} as const;

export default async function BulkImportPage() {
  const session = await requireAccountAdmin();
  const jobs = await listImportJobs(session.user.accountId!);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Bulk Location Import</h1>
        <p className="text-sm text-muted mt-1">
          Upload a filled-in CSV to create many locations at once, 100 rows per review batch.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-bold text-foreground mb-3">Start a new import</h2>
        <UploadForm />
        <p className="text-xs text-muted-2 mt-3">
          Download the template, fill it in (Google Sheets works fine - just download as CSV when
          done), then upload it here. Nothing is created until you review and commit each batch.
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        {jobs.length === 0 ? (
          <Card>
            <p className="text-sm text-muted text-center py-4">No imports yet.</p>
          </Card>
        ) : (
          jobs.map((job) => (
            <Link key={job.id} href={`/locations/import/${job.id}`}>
              <Card className="hover:bg-surface-hover transition">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{job.fileName}</span>
                      <Badge tone={STATUS_TONE[job.status]}>{job.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-2 mt-1">
                      {job.totalRows} rows &middot; {job.importedCount} imported &middot; {job.invalidCount} invalid
                    </p>
                  </div>
                  <span className="text-xs text-muted-2">{new Date(job.createdAt).toLocaleString()}</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
