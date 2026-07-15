import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export function computeComplianceStatus(nextDueDate: Date): "OVERDUE" | "DUE_SOON" | "UPCOMING" {
  const now = new Date();
  if (nextDueDate < now) return "OVERDUE";
  if (nextDueDate < addDays(now, 7)) return "DUE_SOON";
  return "UPCOMING";
}

export async function getComplianceOverview(locationId: string) {
  const items = await prisma.complianceItem.findMany({
    where: { locationId },
    orderBy: { nextDueDate: "asc" },
  });
  return items.map((item) => ({ ...item, status: computeComplianceStatus(item.nextDueDate) }));
}

const FREQUENCY_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  ANNUAL: 365,
};

export async function completeComplianceItem(
  id: string,
  userId: string,
  passed: boolean,
  notes?: string
) {
  const item = await prisma.complianceItem.findUniqueOrThrow({ where: { id } });
  const nextDueDate = addDays(new Date(), FREQUENCY_DAYS[item.frequency] ?? 30);

  await prisma.complianceLog.create({
    data: { complianceItemId: id, completedById: userId, passed, notes },
  });

  return prisma.complianceItem.update({
    where: { id },
    data: { lastCompletedAt: new Date(), nextDueDate, status: computeComplianceStatus(nextDueDate) },
  });
}
