import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

let counter = 0;
/** A short unique-ish suffix per test run so fixtures never collide across test files. */
export function uniq(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createTestAccount(name = uniq("Test Account")) {
  return prisma.account.create({ data: { name } });
}

export async function createTestLocation(accountId: string, overrides: Partial<Prisma.LocationUncheckedCreateInput> = {}) {
  return prisma.location.create({
    data: {
      accountId,
      name: uniq("Test Location"),
      type: "GAS_STATION",
      ...overrides,
    },
  });
}

export async function createTestUser(accountId: string | null, overrides: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  const passwordHash = await bcrypt.hash("test-password-123", 4);
  return prisma.user.create({
    data: {
      accountId,
      email: uniq("user").toLowerCase() + "@example.com",
      passwordHash,
      name: "Test User",
      role: "OWNER",
      ...overrides,
    },
  });
}

/** Deletes an account and everything cascaded under it - call in afterAll/afterEach to keep tests isolated. */
export async function cleanupAccount(accountId: string) {
  await prisma.account.delete({ where: { id: accountId } }).catch(() => undefined);
}

export async function createTestCategory(accountId: string, name = uniq("Category")) {
  return prisma.inventoryCategory.create({ data: { accountId, name } });
}

export async function createTestSupplier(accountId: string, overrides: Partial<Prisma.SupplierUncheckedCreateInput> = {}) {
  return prisma.supplier.create({
    data: {
      accountId,
      name: uniq("Supplier"),
      leadTimeDays: 3,
      ...overrides,
    },
  });
}

export async function createTestInventoryItem(
  locationId: string,
  categoryId: string,
  overrides: Partial<Prisma.InventoryItemUncheckedCreateInput> = {}
) {
  return prisma.inventoryItem.create({
    data: {
      locationId,
      categoryId,
      name: uniq("Item"),
      currentStock: 10,
      parLevel: 20,
      reorderPoint: 8,
      reorderQuantity: 15,
      unitCost: 5,
      ...overrides,
    },
  });
}

export async function createTestStaffMember(locationId: string, overrides: Partial<Prisma.StaffMemberUncheckedCreateInput> = {}) {
  return prisma.staffMember.create({
    data: {
      locationId,
      name: uniq("Staff Member"),
      hourlyRate: 15,
      ...overrides,
    },
  });
}
