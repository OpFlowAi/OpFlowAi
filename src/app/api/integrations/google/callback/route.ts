import { NextRequest, NextResponse } from "next/server";
import { requireSession, canAccessLocation } from "@/lib/authz";
import { googleHandleCallback } from "@/server/services/integrations";

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (!locationId || !code) {
    return NextResponse.redirect(new URL("/settings?error=google_invalid_state", req.url));
  }

  try {
    const session = await requireSession();
    if (!canAccessLocation(session.user, locationId)) {
      return NextResponse.redirect(new URL("/settings?error=google_forbidden", req.url));
    }
    await googleHandleCallback(code, locationId, session.user.id);
    return NextResponse.redirect(new URL("/settings?connected=google", req.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=google_connect_failed", req.url));
  }
}
