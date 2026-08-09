import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  runReorderScan,
  createManualReorder,
  decidePurchaseOrder,
  markPurchaseOrderReceived,
  computeStockStatus,
} from "@/server/services/inventory";
import {
  createTestAccount,
  createTestLocation,
  createTestUser,
  createTestCategory,
  createTestSupplier,
  createTestInventoryItem,
  cleanupAccount,
} from "./helpers";

describe("computeStockStatus", () => {
  it("is CRITICAL at or below zero", () => {
    expect(computeStockStatus(0, 5, 20)).toBe("CRITICAL");
    expect(computeStockStatus(-1, 5, 20)).toBe("CRITICAL");
  });

  it("is LOW at or below the reorder point", () => {
    expect(computeStockStatus(5, 5, 20)).toBe("LOW");
  });

  it("is OK well above the reorder point", () => {
    expect(computeStockStatus(20, 5, 20)).toBe("OK");
  });
});

describe("inventory reorder flow", () => {
  let accountId: string;

  afterEach(async () => {
    if (accountId) await cleanupAccount(accountId);
  });

  it("runReorderScan drafts a PO in DRAFT_APPROVAL mode and skips it on a second run", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId, { reorderApprovalMode: "DRAFT_APPROVAL" });
    const category = await createTestCategory(accountId);
    const supplier = await createTestSupplier(accountId);
    const item = await createTestInventoryItem(location.id, category.id, {
      currentStock: 2,
      reorderPoint: 8,
      reorderQuantity: 15,
      unitCost: 4,
      preferredSupplierId: supplier.id,
    });

    const created = await runReorderScan(location.id);
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("PENDING_APPROVAL");
    expect(created[0].items[0].inventoryItemId).toBe(item.id);

    // Idempotent: the item is now covered by an open PO, so scanning again creates nothing.
    const secondRun = await runReorderScan(location.id);
    expect(secondRun).toHaveLength(0);
  });

  it("runReorderScan auto-orders in AUTOMATIC mode", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId, { reorderApprovalMode: "AUTOMATIC" });
    const category = await createTestCategory(accountId);
    const supplier = await createTestSupplier(accountId);
    await createTestInventoryItem(location.id, category.id, {
      currentStock: 1,
      reorderPoint: 8,
      preferredSupplierId: supplier.id,
    });

    const created = await runReorderScan(location.id);
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("ORDERED");
    expect(created[0].orderedAt).not.toBeNull();
  });

  it("does not reorder an item with autoReorderEnabled explicitly false", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    const category = await createTestCategory(accountId);
    const supplier = await createTestSupplier(accountId);
    await createTestInventoryItem(location.id, category.id, {
      currentStock: 0,
      reorderPoint: 10,
      preferredSupplierId: supplier.id,
      autoReorderEnabled: false,
    });

    const created = await runReorderScan(location.id);
    expect(created).toHaveLength(0);
  });

  it("manual reorder, approval, and receiving increments stock", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId, { reorderApprovalMode: "DRAFT_APPROVAL" });
    const category = await createTestCategory(accountId);
    const supplier = await createTestSupplier(accountId);
    const user = await createTestUser(accountId);
    const item = await createTestInventoryItem(location.id, category.id, {
      currentStock: 3,
      reorderQuantity: 10,
      preferredSupplierId: supplier.id,
    });

    const po = await createManualReorder(location.id, item.id, user.id);
    expect(po.status).toBe("PENDING_APPROVAL");

    const approved = await decidePurchaseOrder(po.id, user.id, "approve");
    expect(approved.status).toBe("ORDERED");

    await markPurchaseOrderReceived(po.id);
    const updatedItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(Number(updatedItem.currentStock)).toBe(13); // 3 + reorderQuantity(10)

    const finalPo = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(finalPo.status).toBe("RECEIVED");
  });

  it("rejecting a purchase order cancels it without touching stock", async () => {
    const account = await createTestAccount();
    accountId = account.id;
    const location = await createTestLocation(accountId);
    const category = await createTestCategory(accountId);
    const supplier = await createTestSupplier(accountId);
    const user = await createTestUser(accountId);
    const item = await createTestInventoryItem(location.id, category.id, {
      currentStock: 3,
      preferredSupplierId: supplier.id,
    });

    const po = await createManualReorder(location.id, item.id, user.id);
    const rejected = await decidePurchaseOrder(po.id, user.id, "reject");
    expect(rejected.status).toBe("CANCELLED");

    const unchangedItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(Number(unchangedItem.currentStock)).toBe(3);
  });
});
