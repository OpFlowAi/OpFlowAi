"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/authz";
import { markAlertRead, markAllAlertsRead } from "@/server/services/alerts";

export async function markAlertReadAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const alertId = String(formData.get("alertId"));
  await requireLocationAccess(locationId);
  await markAlertRead(alertId);
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}

export async function markAllAlertsReadAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  await requireLocationAccess(locationId);
  await markAllAlertsRead(locationId);
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}
