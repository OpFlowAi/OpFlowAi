import { describe, it, expect, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { executeReadTool } from "@/lib/agent/read-executors";
import { proposeWriteTool } from "@/lib/agent/write-tools";
import { executeAgentAction } from "@/lib/agent/execute-action";
import {
  createTestAccount,
  createTestLocation,
  createTestUser,
  createTestCategory,
  createTestSupplier,
  createTestInventoryItem,
  createTestStaffMember,
} from "./helpers";

describe("AI agent read tools", () => {
  let accountId: string;

  afterEach(async () => {
    if (accountId) await prisma.account.delete({ where: { id: accountId } }).catch(() => undefined);
  });

  it("get_inventory_status reports real stock levels and status", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    const category = await createTestCategory(accountId, "Beverages");
    await createTestInventoryItem(location.id, category.id, {
      name: "Bottled Water",
      currentStock: 2,
      reorderPoint: 8,
      parLevel: 20,
    });

    const result = (await executeReadTool("get_inventory_status", {}, { locationId: location.id, accountId })) as Array<{
      name: string;
      status: string;
    }>;
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Bottled Water");
    expect(result[0].status).toBe("LOW");
  });

  it("get_dashboard_summary returns zeroed revenue for a fresh location", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);

    const result = (await executeReadTool("get_dashboard_summary", {}, { locationId: location.id, accountId })) as {
      todayRevenue: number;
    };
    expect(result.todayRevenue).toBe(0);
  });
});

describe("AI agent write tool proposals (never mutate on their own)", () => {
  let accountId: string;

  afterEach(async () => {
    if (accountId) await prisma.account.delete({ where: { id: accountId } }).catch(() => undefined);
  });

  it("add_task proposes without creating a task", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);

    const result = await proposeWriteTool("add_task", { title: "Check freezer" }, { locationId: location.id, accountId });
    expect(result.ok).toBe(true);
    expect(result.payload?.title).toBe("Check freezer");

    const taskCount = await prisma.task.count({ where: { locationId: location.id } });
    expect(taskCount).toBe(0);
  });

  it("log_time_off resolves a fuzzy staff name match", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    const staff = await createTestStaffMember(location.id, { name: "Brian Cole" });

    const result = await proposeWriteTool(
      "log_time_off",
      { staff_member_name: "brian", start_date: "2026-08-01", end_date: "2026-08-02" },
      { locationId: location.id, accountId }
    );
    expect(result.ok).toBe(true);
    expect(result.payload?.staffMemberId).toBe(staff.id);
  });

  it("log_time_off suggests candidates when the name doesn't uniquely match", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    await createTestStaffMember(location.id, { name: "Brian Cole" });

    const result = await proposeWriteTool(
      "log_time_off",
      { staff_member_name: "zzz-nobody", start_date: "2026-08-01", end_date: "2026-08-02" },
      { locationId: location.id, accountId }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/did you mean.*brian cole/i);
  });

  it("log_time_off reports no staff at all when the location has none", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);

    const result = await proposeWriteTool(
      "log_time_off",
      { staff_member_name: "anyone", start_date: "2026-08-01", end_date: "2026-08-02" },
      { locationId: location.id, accountId }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no staff member found/i);
  });

  it("mark_item_reordered fails clearly when the item has no preferred supplier", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    const category = await createTestCategory(accountId);
    await createTestInventoryItem(location.id, category.id, { name: "Orphan Item" });

    const result = await proposeWriteTool("mark_item_reordered", { item_name: "Orphan Item" }, { locationId: location.id, accountId });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no preferred supplier/i);
  });

  it("mark_item_reordered succeeds and executeAgentAction then creates a real purchase order", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    const category = await createTestCategory(accountId);
    const supplier = await createTestSupplier(accountId);
    const user = await createTestUser(accountId);
    await createTestInventoryItem(location.id, category.id, {
      name: "Snickers",
      preferredSupplierId: supplier.id,
      reorderQuantity: 12,
      unitCost: 1.5,
    });

    const proposal = await proposeWriteTool("mark_item_reordered", { item_name: "Snickers" }, { locationId: location.id, accountId });
    expect(proposal.ok).toBe(true);

    const conversation = await prisma.conversation.create({ data: { userId: user.id, locationId: location.id } });
    const action = await prisma.agentAction.create({
      data: {
        conversationId: conversation.id,
        locationId: location.id,
        actionType: "MARK_ITEM_REORDERED",
        payload: proposal.payload as Prisma.InputJsonValue,
        status: "PENDING_CONFIRMATION",
      },
    });

    const summary = await executeAgentAction(action, user.id);
    expect(summary).toMatch(/Snickers/);

    const poCount = await prisma.purchaseOrder.count({ where: { locationId: location.id } });
    expect(poCount).toBe(1);
  });
});

describe("runAgentTurn (Anthropic client mocked - no real API calls)", () => {
  let accountId: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (accountId) await prisma.account.delete({ where: { id: accountId } }).catch(() => undefined);
  });

  it("a proposed write action is persisted as PENDING_CONFIRMATION and does not mutate data until confirmed", async () => {
    vi.doMock("@/lib/anthropic", () => ({
      AGENT_MODEL: "test-model",
      getAnthropicClient: () => ({
        messages: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              content: [
                { type: "text", text: "I'll draft that time-off request." },
                {
                  type: "tool_use",
                  id: "tu_1",
                  name: "log_time_off",
                  input: { staff_member_name: "Brian", start_date: "2026-08-01", end_date: "2026-08-02" },
                },
              ],
            })
            .mockResolvedValueOnce({
              content: [{ type: "text", text: "Drafted - let me know if you'd like me to go ahead." }],
            }),
        },
      }),
    }));
    const { runAgentTurn } = await import("@/lib/agent/chat");

    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    const user = await createTestUser(accountId);
    await createTestStaffMember(location.id, { name: "Brian Cole" });
    const conversation = await prisma.conversation.create({ data: { userId: user.id, locationId: location.id } });

    const result = await runAgentTurn({
      conversationId: conversation.id,
      userId: user.id,
      userName: user.name,
      locationId: location.id,
      accountId,
      userMessageText: "Log time off for Brian next weekend",
    });

    expect(result.pendingActionIds).toHaveLength(1);
    expect(result.assistantText).toBe("Drafted - let me know if you'd like me to go ahead.");

    const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: result.pendingActionIds[0] } });
    expect(action.status).toBe("PENDING_CONFIRMATION");
    expect(action.actionType).toBe("LOG_TIME_OFF");

    // Nothing should be written until the user confirms.
    const timeOffCount = await prisma.timeOffRequest.count();
    expect(timeOffCount).toBe(0);

    // Confirming now executes it for real.
    await executeAgentAction(action, user.id);
    const confirmedCount = await prisma.timeOffRequest.count({ where: { staffMemberId: { not: undefined } } });
    expect(confirmedCount).toBe(1);
  });
});
