import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { validateRow, type NormalizedLocationRow } from "@/lib/bulk-import/validate";
import { Prisma } from "@prisma/client";

const MAX_ROWS = 5000;

export class CsvParseError extends Error {}

export function parseCsv(csvText: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0) {
    throw new CsvParseError(result.errors[0].message);
  }
  if (result.data.length === 0) {
    throw new CsvParseError("The file has no data rows.");
  }
  if (result.data.length > MAX_ROWS) {
    throw new CsvParseError(`The file has ${result.data.length} rows, which exceeds the ${MAX_ROWS}-row limit.`);
  }
  return result.data;
}

export async function createImportJob(
  accountId: string,
  createdById: string,
  fileName: string,
  rows: Record<string, string>[]
) {
  const job = await prisma.bulkImportJob.create({
    data: {
      accountId,
      createdById,
      fileName,
      totalRows: rows.length,
      status: "DRAFT",
    },
  });

  await prisma.bulkImportRow.createMany({
    data: rows.map((data, i) => ({
      jobId: job.id,
      rowNumber: i + 1,
      data: data as Prisma.InputJsonValue,
    })),
  });

  return job;
}

export async function listImportJobs(accountId: string) {
  const jobs = await prisma.bulkImportJob.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    jobs.map(async (job) => {
      const counts = await prisma.bulkImportRow.groupBy({
        by: ["status"],
        where: { jobId: job.id },
        _count: true,
      });
      const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));
      return {
        ...job,
        validCount: byStatus.VALID ?? 0,
        invalidCount: byStatus.INVALID ?? 0,
        importedCount: byStatus.IMPORTED ?? 0,
        pendingCount: byStatus.PENDING ?? 0,
      };
    })
  );
}

export async function getImportJob(jobId: string, accountId: string) {
  const job = await prisma.bulkImportJob.findFirstOrThrow({ where: { id: jobId, accountId } });
  const counts = await prisma.bulkImportRow.groupBy({
    by: ["status"],
    where: { jobId },
    _count: true,
  });
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  return {
    ...job,
    validCount: byStatus.VALID ?? 0,
    invalidCount: byStatus.INVALID ?? 0,
    importedCount: byStatus.IMPORTED ?? 0,
    pendingCount: byStatus.PENDING ?? 0,
  };
}

export async function getImportRows(
  jobId: string,
  accountId: string,
  opts: { from?: number; to?: number } = {}
) {
  await prisma.bulkImportJob.findFirstOrThrow({ where: { id: jobId, accountId } });
  return prisma.bulkImportRow.findMany({
    where: {
      jobId,
      ...(opts.from !== undefined || opts.to !== undefined
        ? { rowNumber: { gte: opts.from ?? 1, lte: opts.to } }
        : {}),
    },
    orderBy: { rowNumber: "asc" },
  });
}

/**
 * Validates the next un-validated batch (dry run - never writes Locations).
 * Classifies each row VALID/INVALID with specific error messages.
 */
export async function validateNextBatch(jobId: string, accountId: string) {
  const job = await prisma.bulkImportJob.findFirstOrThrow({ where: { id: jobId, accountId } });

  const batchRows = await prisma.bulkImportRow.findMany({
    where: { jobId, status: "PENDING" },
    orderBy: { rowNumber: "asc" },
    take: job.batchSize,
  });
  if (batchRows.length === 0) {
    return { validated: 0, job: await getImportJob(jobId, accountId) };
  }

  await prisma.$transaction(
    batchRows.map((row) => {
      const result = validateRow(row.data as Record<string, string>);
      return prisma.bulkImportRow.update({
        where: { id: row.id },
        data: {
          status: result.valid ? "VALID" : "INVALID",
          errors: result.valid ? Prisma.JsonNull : (result.errors as Prisma.InputJsonValue),
        },
      });
    })
  );

  const maxRowNumber = Math.max(...batchRows.map((r) => r.rowNumber));
  const remainingPending = await prisma.bulkImportRow.count({ where: { jobId, status: "PENDING" } });

  await prisma.bulkImportJob.update({
    where: { id: jobId },
    data: {
      validatedThru: maxRowNumber,
      status: remainingPending === 0 ? "READY" : "VALIDATING",
    },
  });

  return { validated: batchRows.length, job: await getImportJob(jobId, accountId) };
}

/** Commits the next batch of already-validated rows: creates a Location for every VALID row in the window. */
export async function commitNextBatch(jobId: string, accountId: string) {
  const job = await prisma.bulkImportJob.findFirstOrThrow({ where: { id: jobId, accountId } });

  const from = job.importedThru + 1;
  const to = job.importedThru + job.batchSize;
  const batchRows = await prisma.bulkImportRow.findMany({
    where: { jobId, rowNumber: { gte: from, lte: to }, status: { in: ["VALID", "INVALID"] } },
    orderBy: { rowNumber: "asc" },
  });

  let imported = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of batchRows) {
      if (row.status !== "VALID") {
        skipped++;
        continue;
      }
      const data = row.data as Record<string, string>;
      const result = validateRow(data);
      if (!result.normalized) {
        skipped++;
        continue;
      }
      const normalized: NormalizedLocationRow = result.normalized;
      const location = await tx.location.create({
        data: {
          accountId,
          name: normalized.name,
          type: normalized.type,
          hasRestaurant: normalized.hasRestaurant,
          addressLine1: normalized.addressLine1,
          city: normalized.city,
          state: normalized.state,
          postalCode: normalized.postalCode,
          contactName: normalized.contactName,
          contactEmail: normalized.contactEmail,
          contactPhone: normalized.contactPhone,
          timezone: normalized.timezone,
          openedAt: new Date(),
        },
      });
      await tx.bulkImportRow.update({
        where: { id: row.id },
        data: { status: "IMPORTED", createdLocationId: location.id },
      });
      imported++;
    }

    const bumpedThru = Math.min(to, job.totalRows);
    const remaining = await tx.bulkImportRow.count({
      where: { jobId, status: { in: ["PENDING", "VALID"] } },
    });
    await tx.bulkImportJob.update({
      where: { id: jobId },
      data: {
        importedThru: bumpedThru,
        status: remaining === 0 ? "COMPLETED" : "IMPORTING",
      },
    });
  });

  return { imported, skipped, job: await getImportJob(jobId, accountId) };
}
