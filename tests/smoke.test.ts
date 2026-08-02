import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestAccount, createTestLocation, cleanupAccount } from "./helpers";

describe("test infrastructure", () => {
  it("connects to the test database and can create/read/clean up fixtures", async () => {
    const account = await createTestAccount();
    const location = await createTestLocation(account.id);

    const found = await prisma.location.findUnique({ where: { id: location.id } });
    expect(found?.accountId).toBe(account.id);

    await cleanupAccount(account.id);
    const afterCleanup = await prisma.location.findUnique({ where: { id: location.id } });
    expect(afterCleanup).toBeNull();
  });
});
