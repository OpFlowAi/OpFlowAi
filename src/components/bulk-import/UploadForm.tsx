"use client";

import { useActionState } from "react";
import { Upload, Download } from "lucide-react";
import { startImportAction } from "@/server/actions/bulk-import";

const initialState: { error: string } | undefined = undefined;

export function UploadForm() {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await startImportAction(formData);
    return result ?? undefined;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="flex-1 min-w-[220px] rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand-purple/20 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-brand-purple"
        />
        <button
          disabled={pending}
          className="flex items-center gap-2 rounded-xl gradient-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          <Upload size={14} /> {pending ? "Uploading..." : "Upload & start import"}
        </button>
        <a
          href="/api/locations/import/template"
          className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm font-bold hover:bg-surface-hover"
        >
          <Download size={14} /> Download template CSV
        </a>
      </div>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
