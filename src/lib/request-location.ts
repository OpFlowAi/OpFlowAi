import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireSession, canAccessLocation, ForbiddenError } from "@/lib/authz";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/active-location";

/**
 * Resolves + authorizes the location an API route should scope its query to:
 * explicit ?locationId= query param takes precedence, falling back to the
 * active-location cookie. Every location-scoped API route calls this first.
 */
export async function resolveRequestLocation(req: NextRequest) {
  const session = await requireSession();
  const queryLocationId = req.nextUrl.searchParams.get("locationId");
  const cookieStore = await cookies();
  const locationId = queryLocationId ?? cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value;

  if (!locationId) {
    throw new ForbiddenError("No active location selected");
  }
  if (!canAccessLocation(session.user, locationId)) {
    throw new ForbiddenError("You do not have access to this location");
  }

  return { session, locationId };
}
