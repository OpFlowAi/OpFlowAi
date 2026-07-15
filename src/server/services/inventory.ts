import { prisma } from "@/lib/prisma";
import type { PurchaseOrderSource } from "@prisma/client";

export type StockStatus = "OK" | "LOW" | "CRITICAL";

export function computeStockStatus(currentStock: number, reorderPoint: number, parLevel: number): StockStatus {
  if (currentStock <= 0) return "CRITICAL";
  if (currentStock <= reorderPoint) return "LOW";
  if (parLevel > 0 && currentStock < reorderPoint * 1.5) return "LOW";
  return "OK";
}

export async function listCategories(accountId: string) {
  return prisma.inventoryCategory.findMany({
    where: { accountId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listInventory(locationId: string, categoryId?: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { locationId, ...(categoryId ? { categoryId } : {}) },
    include: { category: true, preferredSupplier: true },
    orderBy: { name: "asc" },
  });

  return items.map((item) => {
    const currentStock = Number(item.currentStock);
    const reorderPoint = Number(item.reorderPoint);
    const parLevel = Number(item.parLevel);
    return {
      ...item,
      currentStock,
      reorderPoint,
      parLevel,
      reorderQuantity: Number(item.reorderQuantity),
      unitCost: Number(item.unitCost),
      stockPct: parLevel > 0 ? Math.min(100, Math.round((currentStock / parLevel) * 100)) : 0,
      status: computeStockStatus(currentStock, reorderPoint, parLevel),
    };
  });
}

/** Items due for reorder that don't already have an open PO covering them. */
async function getUncoveredLowStockItems(locationId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { locationId },
    include: { preferredSupplier: true },
  });
  // autoReorderEnabled is nullable (null = inherit location default = on), and
  // Prisma's `not: false` excludes NULL rows under standard SQL semantics, so
  // filter in JS instead of relying on a `where` clause here.
  const lowStock = items.filter(
    (i) => i.autoReorderEnabled !== false && Number(i.currentStock) <= Number(i.reorderPoint)
  );
  if (lowStock.length === 0) return [];

  const openItems = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        locationId,
        status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED"] },
      },
    },
    select: { inventoryItemId: true },
  });
  const coveredIds = new Set(openItems.map((i) => i.inventoryItemId));

  return lowStock.filter((i) => !coveredIds.has(i.id) && i.preferredSupplierId);
}

/**
 * Scans a location's inventory for items at/below reorder point and drafts
 * (or auto-places, per the location's approval mode) purchase orders,
 * grouped by supplier. Idempotent - skips items already covered by an open PO.
 */
export async function runReorderScan(locationId: string, source: PurchaseOrderSource = "AUTO_REORDER") {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const uncovered = await getUncoveredLowStockItems(locationId);
  if (uncovered.length === 0) return [];

  const bySupplier = new Map<string, typeof uncovered>();
  for (const item of uncovered) {
    const key = item.preferredSupplierId!;
    if (!bySupplier.has(key)) bySupplier.set(key, []);
    bySupplier.get(key)!.push(item);
  }

  const automatic = location.reorderApprovalMode === "AUTOMATIC";
  const created = [];
  for (const [supplierId, supplierItems] of bySupplier) {
    const totalCost = supplierItems.reduce(
      (sum, i) => sum + Number(i.reorderQuantity) * Number(i.unitCost),
      0
    );
    const po = await prisma.purchaseOrder.create({
      data: {
        locationId,
        supplierId,
        source,
        status: automatic ? "ORDERED" : "PENDING_APPROVAL",
        orderedAt: automatic ? new Date() : null,
        totalCost,
        items: {
          create: supplierItems.map((i) => ({
            inventoryItemId: i.id,
            quantity: i.reorderQuantity,
            unitCost: i.unitCost,
          })),
        },
      },
      include: { items: true, supplier: true },
    });
    created.push(po);
  }
  return created;
}

export async function getReorderQueue(locationId: string) {
  return prisma.purchaseOrder.findMany({
    where: { locationId, status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED"] } },
    include: {
      supplier: true,
      items: { include: { inventoryItem: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createManualReorder(locationId: string, itemId: string, userId: string) {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
  const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.preferredSupplierId) throw new Error("Item has no preferred supplier to order from");

  const automatic = location.reorderApprovalMode === "AUTOMATIC";
  const quantity = Number(item.reorderQuantity) || 1;
  const unitCost = Number(item.unitCost);

  return prisma.purchaseOrder.create({
    data: {
      locationId,
      supplierId: item.preferredSupplierId,
      source: "MANUAL",
      status: automatic ? "ORDERED" : "PENDING_APPROVAL",
      orderedAt: automatic ? new Date() : null,
      createdById: userId,
      totalCost: quantity * unitCost,
      items: { create: [{ inventoryItemId: item.id, quantity, unitCost }] },
    },
    include: { items: true, supplier: true },
  });
}

export async function decidePurchaseOrder(
  poId: string,
  userId: string,
  decision: "approve" | "reject"
) {
  if (decision === "reject") {
    return prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: "CANCELLED", approvedById: userId },
    });
  }
  return prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "ORDERED", approvedById: userId, orderedAt: new Date() },
  });
}

export async function markPurchaseOrderReceived(poId: string) {
  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { items: true },
  });

  await prisma.$transaction([
    ...po.items.map((item) =>
      prisma.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: { currentStock: { increment: item.quantity }, lastCountedAt: new Date() },
      })
    ),
    prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: "RECEIVED", receivedAt: new Date() },
    }),
  ]);
}

/** Marks a single low-stock item as already reordered outside the system (e.g. a phone call to the supplier). */
export async function markItemReordered(locationId: string, itemId: string, userId: string) {
  return createManualReorder(locationId, itemId, userId);
}
