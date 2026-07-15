import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/authz";
import { isQuickBooksConfigured, quickbooksAuthUrl } from "@/server/services/integrations";

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) return NextResponse.redirect(new URL("/settings", req.url));

  try {
    await requireLocationAccess(locationId);
  } catch {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  if (!isQuickBooksConfigured()) {
    return NextResponse.redirect(new URL("/settings?error=quickbooks_not_configured", req.url));
  }

  return NextResponse.redirect(quickbooksAuthUrl(locationId));
}
