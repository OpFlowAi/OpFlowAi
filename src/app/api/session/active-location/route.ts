import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireSession, canAccessLocation } from "@/lib/authz";
import { accessibleLocationIds } from "@/lib/authz";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/active-location";
import { handleApiError } from "@/lib/api-error";

const bodySchema = z.object({ locationId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { locationId } = bodySchema.parse(await req.json());
    const allowedIds = await accessibleLocationIds(session);

    if (!canAccessLocation(session.user, locationId) || !allowedIds.includes(locationId)) {
      return NextResponse.json({ error: "You do not have access to this location" }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_LOCATION_COOKIE, locationId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ ok: true, locationId });
  } catch (error) {
    return handleApiError(error);
  }
}
