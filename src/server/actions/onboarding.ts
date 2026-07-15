"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireLocationAccess } from "@/lib/authz";
import { createStaffMember } from "@/server/services/staffing";
import { setReorderApprovalMode } from "@/server/services/locations";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/active-location";

export async function addOnboardingStaffAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  await requireLocationAccess(locationId);

  const name = String(formData.get("name") ?? "").trim();
  const hourlyRate = Number(formData.get("hourlyRate"));
  if (name && Number.isFinite(hourlyRate)) {
    await createStaffMember(locationId, {
      name,
      title: String(formData.get("title") ?? "") || undefined,
      hourlyRate,
      employmentType: (String(formData.get("employmentType")) as "FULL_TIME" | "PART_TIME") || "PART_TIME",
    });
  }

  revalidatePath("/onboarding");
  redirect(`/onboarding?locationId=${locationId}&step=2`);
}

export async function finishOnboardingAction(formData: FormData) {
  const locationId = String(formData.get("locationId"));
  await requireLocationAccess(locationId);

  const mode = String(formData.get("mode")) as "AUTOMATIC" | "DRAFT_APPROVAL";
  await setReorderApprovalMode(locationId, mode);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_LOCATION_COOKIE, locationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
