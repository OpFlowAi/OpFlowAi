import { prisma } from "@/lib/prisma";

export async function getBankSummary(locationId: string) {
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { locationId },
    include: { transactions: { orderBy: { date: "desc" }, take: 10 } },
  });

  if (bankAccounts.length === 0) {
    return { connected: false as const, accounts: [] };
  }

  return {
    connected: true as const,
    accounts: bankAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      mask: a.mask,
      currentBalance: Number(a.currentBalance),
      availableBalance: a.availableBalance ? Number(a.availableBalance) : null,
      recentTransactions: a.transactions.map((t) => ({
        date: t.date,
        name: t.name,
        amount: Number(t.amount),
        pending: t.pending,
      })),
    })),
  };
}
