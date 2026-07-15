import { prisma } from "@/lib/prisma";
import type { LocationStatus, LocationType, ReorderApprovalMode } from "@prisma/client";

export async function setReorderApprovalMode(locationId: string, mode: ReorderApprovalMode) {
  return prisma.location.update({ where: { id: locationId }, data: { reorderApprovalMode: mode } });
}

export async function listLocationsForAccount(accountId: string) {
  return prisma.location.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    include: { _count: { select: { staffMembers: true, inventoryItems: true } } },
  });
}

export async function getLocation(id: string) {
  return prisma.location.findUniqueOrThrow({ where: { id } });
}

export interface LocationInput {
  name: string;
  type: LocationType;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  timezone?: string;
}

export async function createLocation(accountId: string, input: LocationInput) {
  return prisma.location.create({
    data: {
      accountId,
      name: input.name,
      type: input.type,
      addressLine1: input.addressLine1,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      timezone: input.timezone || "America/Chicago",
      openedAt: new Date(),
    },
  });
}

export async function updateLocation(id: string, input: LocationInput) {
  return prisma.location.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      addressLine1: input.addressLine1,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      timezone: input.timezone || "America/Chicago",
    },
  });
}

export async function setLocationStatus(id: string, status: LocationStatus) {
  return prisma.location.update({ where: { id }, data: { status } });
}
