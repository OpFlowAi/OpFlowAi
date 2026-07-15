"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/authz";
import {
  disconnectIntegration,
  quickbooksSyncCompanyInfo,
  googleSetSpreadsheet,
  googleSyncInventoryToSheet,
} from "@/server/services/integrations";

export async function disconnectIntegrationAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const provider = String(formData.get("provider")) as "QUICKBOOKS" | "GOOGLE_SHEETS";
  await requireLocationAccess(locationId);
  await disconnectIntegration(locationId, provider);
  revalidatePath("/settings");
}

export async function syncQuickBooksAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  await requireLocationAccess(locationId);
  await quickbooksSyncCompanyInfo(locationId);
  revalidatePath("/settings");
}

export async function setGoogleSheetAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const spreadsheetId = String(formData.get("spreadsheetId") ?? "").trim();
  await requireLocationAccess(locationId);
  if (spreadsheetId) await googleSetSpreadsheet(locationId, spreadsheetId);
  revalidatePath("/settings");
}

export async function syncGoogleSheetAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  await requireLocationAccess(locationId);
  await googleSyncInventoryToSheet(locationId);
  revalidatePath("/settings");
}
