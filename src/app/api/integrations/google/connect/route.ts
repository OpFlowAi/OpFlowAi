import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/authz";
import { isGoogleConfigured, googleAuthUrl } from "@/server/services/integrations";

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) return NextResponse.redirect(new URL("/settings", req.url));

  try {
    await requireLocationAccess(locationId);
  } catch {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/settings?error=google_not_configured", req.url));
  }

  return NextResponse.redirect(googleAuthUrl(locationId));
}
