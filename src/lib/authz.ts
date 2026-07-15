import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class UnauthorizedError extends Error {
  status = 401;
}
export class ForbiddenError extends Error {
  status = 403;
}

const ACCOUNT_WIDE_ROLES = new Set(["PLATFORM_ADMIN", "OWNER", "ADMIN"]);

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  return session;
}

/** Returns true if the session's user may access the given location. */
export function canAccessLocation(
  user: { role: string; locationIds: string[] },
  locationId: string
) {
  if (ACCOUNT_WIDE_ROLES.has(user.role)) return true;
  return user.locationIds.includes(locationId);
}

/** Throws if the current session cannot access the given location. Returns the session on success. */
export async function requireLocationAccess(locationId: string) {
  const session = await requireSession();
  if (!canAccessLocation(session.user, locationId)) {
    throw new ForbiddenError("You do not have access to this location");
  }
  return session;
}

/** Throws unless the session's user is an account-wide admin (owner/admin/platform admin). */
export async function requireAccountAdmin() {
  const session = await requireSession();
  if (!ACCOUNT_WIDE_ROLES.has(session.user.role)) {
    throw new ForbiddenError("Only account admins can do that");
  }
  return session;
}

/** All location IDs the session's user may see, scoped to their account. */
export async function accessibleLocationIds(session: Awaited<ReturnType<typeof requireSession>>) {
  if (ACCOUNT_WIDE_ROLES.has(session.user.role)) {
    if (!session.user.accountId) return [];
    const locations = await prisma.location.findMany({
      where: { accountId: session.user.accountId },
      select: { id: true },
    });
    return locations.map((l) => l.id);
  }
  return session.user.locationIds;
}
