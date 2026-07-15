import { prisma } from "@/lib/prisma";

export async function listSuppliers(accountId: string) {
  const suppliers = await prisma.supplier.findMany({
    where: { accountId },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: { select: { purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  });
  return suppliers.map((s) => ({ ...s, rating: Number(s.rating) }));
}
