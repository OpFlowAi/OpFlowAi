import { prisma } from "@/lib/prisma";
import type { ReorderApprovalMode } from "@prisma/client";

export async function setReorderApprovalMode(locationId: string, mode: ReorderApprovalMode) {
  return prisma.location.update({ where: { id: locationId }, data: { reorderApprovalMode: mode } });
}
