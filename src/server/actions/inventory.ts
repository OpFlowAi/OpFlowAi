"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/authz";
import {
  createManualReorder,
  decidePurchaseOrder,
  markPurchaseOrderReceived,
  runReorderScan,
} from "@/server/services/inventory";
import { setReorderApprovalMode } from "@/server/services/locations";

export async function reorderItemAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const itemId = String(formData.get("itemId"));
  const session = await requireLocationAccess(locationId);
  await createManualReorder(locationId, itemId, session.user.id);
  revalidatePath("/inventory");
}

export async function runReorderScanAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  await requireLocationAccess(locationId);
  await runReorderScan(locationId);
  revalidatePath("/inventory");
}

export async function decidePurchaseOrderAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const poId = String(formData.get("poId"));
  const decision = String(formData.get("decision")) as "approve" | "reject";
  const session = await requireLocationAccess(locationId);
  await decidePurchaseOrder(poId, session.user.id, decision);
  revalidatePath("/inventory");
}

export async function receivePurchaseOrderAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const poId = String(formData.get("poId"));
  await requireLocationAccess(locationId);
  await markPurchaseOrderReceived(poId);
  revalidatePath("/inventory");
}

export async function setReorderModeAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const mode = String(formData.get("mode")) as "AUTOMATIC" | "DRAFT_APPROVAL";
  await requireLocationAccess(locationId);
  await setReorderApprovalMode(locationId, mode);
  revalidatePath("/inventory");
}
