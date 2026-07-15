"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/authz";
import { completeComplianceItem } from "@/server/services/compliance";

export async function completeComplianceItemAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const itemId = String(formData.get("itemId"));
  const passed = formData.get("passed") === "true";
  const session = await requireLocationAccess(locationId);
  await completeComplianceItem(itemId, session.user.id, passed);
  revalidatePath("/compliance");
}
