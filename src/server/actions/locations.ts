"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccountAdmin } from "@/lib/authz";
import { createLocation, updateLocation, setLocationStatus, type LocationInput } from "@/server/services/locations";
import type { LocationType } from "@prisma/client";

function parseLocationInput(formData: FormData): LocationInput {
  return {
    name: String(formData.get("name") ?? "").trim(),
    type: String(formData.get("type")) as LocationType,
    addressLine1: String(formData.get("addressLine1") ?? "") || undefined,
    city: String(formData.get("city") ?? "") || undefined,
    state: String(formData.get("state") ?? "") || undefined,
    postalCode: String(formData.get("postalCode") ?? "") || undefined,
  };
}

export async function createLocationAction(formData: FormData) {
  const session = await requireAccountAdmin();
  const input = parseLocationInput(formData);
  if (!input.name || !input.type) return;
  if (!session.user.accountId) return;

  const location = await createLocation(session.user.accountId, input);
  revalidatePath("/locations");
  redirect(`/onboarding?locationId=${location.id}`);
}

export async function updateLocationAction(formData: FormData) {
  await requireAccountAdmin();
  const id = String(formData.get("id"));
  const input = parseLocationInput(formData);
  if (!input.name || !input.type) return;
  await updateLocation(id, input);
  revalidatePath("/locations");
}

export async function setLocationStatusAction(formData: FormData) {
  await requireAccountAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "ACTIVE" | "INACTIVE";
  await setLocationStatus(id, status);
  revalidatePath("/locations");
}
