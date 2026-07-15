import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { accessibleLocationIds, requireSession } from "@/lib/authz";

export const ACTIVE_LOCATION_COOKIE = "opflow_active_location";

/**
 * Resolves the location the current request should be scoped to: the cookie
 * value if the user still has access to it, otherwise their first accessible
 * location. Every screen and API route derives its data from this.
 */
export async function getActiveLocation() {
  const session = await requireSession();
  const allowedIds = await accessibleLocationIds(session);
  if (allowedIds.length === 0) return { session, location: null, allowedIds };

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value;
  const activeId = requested && allowedIds.includes(requested) ? requested : allowedIds[0];

  const location = await prisma.location.findUnique({ where: { id: activeId } });
  return { session, location, allowedIds };
}
