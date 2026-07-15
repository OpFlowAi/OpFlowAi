import { NextRequest, NextResponse } from "next/server";
import { requireSession, canAccessLocation } from "@/lib/authz";
import { quickbooksHandleCallback } from "@/server/services/integrations";

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("state");
  if (!locationId) return NextResponse.redirect(new URL("/settings?error=quickbooks_invalid_state", req.url));

  try {
    const session = await requireSession();
    if (!canAccessLocation(session.user, locationId)) {
      return NextResponse.redirect(new URL("/settings?error=quickbooks_forbidden", req.url));
    }
    await quickbooksHandleCallback(req.url, locationId, session.user.id);
    return NextResponse.redirect(new URL("/settings?connected=quickbooks", req.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=quickbooks_connect_failed", req.url));
  }
}
