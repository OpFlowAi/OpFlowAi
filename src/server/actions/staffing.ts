"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/authz";
import { decideTimeOffRequest } from "@/server/services/staffing";

export async function decideTimeOffAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  const requestId = String(formData.get("requestId"));
  const decision = String(formData.get("decision")) as "approve" | "deny";
  const session = await requireLocationAccess(locationId);
  await decideTimeOffRequest(requestId, session.user.id, decision);
  revalidatePath("/staffing");
}
