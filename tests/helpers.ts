import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

let counter = 0;
/** A short unique-ish suffix per test run so fixtures never collide across test files. */
export function uniq(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createTestAccount(name = uniq("Test Account")) {
  return prisma.account.create({ data: { name } });
}

export async function createTestLocation(accountId: string, overrides: Partial<Parameters<typeof prisma.location.create>[0]["data"]> = {}) {
  return prisma.location.create({
    data: {
      accountId,
      name: uniq("Test Location"),
      type: "GAS_STATION",
      ...overrides,
    },
  });
}

export async function createTestUser(
  accountId: string | null,
  overrides: Partial<Parameters<typeof prisma.user.create>[0]["data"]> = {}
) {
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
