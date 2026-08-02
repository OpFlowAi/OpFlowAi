"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccountAdmin } from "@/lib/authz";
import { parseCsv, createImportJob, validateNextBatch, commitNextBatch, CsvParseError } from "@/server/services/bulk-import";

export async function startImportAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await requireAccountAdmin();
  const accountId = session.user.accountId;
  if (!accountId) return { error: "Your account isn't set up for bulk import." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a CSV file to upload." };
  }

  let rows;
  try {
    const text = await file.text();
    rows = parseCsv(text);
  } catch (error) {
    const message = error instanceof CsvParseError ? error.message : "Couldn't parse that file as CSV.";
    return { error: message };
  }

  const job = await createImportJob(accountId, session.user.id, file.name, rows);
  revalidatePath("/locations/import");
  redirect(`/locations/import/${job.id}`);
}

export async function validateBatchAction(formData: FormData) {
  const session = await requireAccountAdmin();
  const jobId = String(formData.get("jobId"));
  await validateNextBatch(jobId, session.user.accountId!);
  revalidatePath(`/locations/import/${jobId}`);
}

export async function commitBatchAction(formData: FormData) {
  const session = await requireAccountAdmin();
  const jobId = String(formData.get("jobId"));
  await commitNextBatch(jobId, session.user.accountId!);
  revalidatePath(`/locations/import/${jobId}`);
  revalidatePath("/locations");
}
