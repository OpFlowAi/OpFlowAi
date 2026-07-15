"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLocationAccess } from "@/lib/authz";
import { syncTransactions, disconnectBank } from "@/server/services/banking";

export async function syncBankAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  await requireLocationAccess(locationId);
  const items = await prisma.plaidItem.findMany({ where: { locationId, status: "ACTIVE" } });
  for (const item of items) {
    await syncTransactions(item.id);
  }
  revalidatePath("/banking");
}

export async function disconnectBankAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const plaidItemId = String(formData.get("plaidItemId"));
  await requireLocationAccess(locationId);
  await disconnectBank(locationId, plaidItemId);
  revalidatePath("/banking");
}
