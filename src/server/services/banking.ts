import { CountryCode, Products } from "plaid";
import { prisma } from "@/lib/prisma";
import { getPlaidClient, isPlaidConfigured } from "@/lib/integrations/plaid-client";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { subDays } from "date-fns";

export { isPlaidConfigured };

export async function getBankSummary(locationId: string) {
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { locationId, plaidItem: { status: "ACTIVE" } },
    include: {
      transactions: { orderBy: { date: "desc" }, take: 15 },
      plaidItem: true,
    },
  });

  if (bankAccounts.length === 0) {
    return { connected: false as const, accounts: [] };
  }

  return {
    connected: true as const,
    accounts: bankAccounts.map((a) => ({
      id: a.id,
      plaidItemId: a.plaidItemId,
      name: a.name,
      mask: a.mask,
      type: a.type,
      currentBalance: Number(a.currentBalance),
      availableBalance: a.availableBalance ? Number(a.availableBalance) : null,
      institutionName: a.plaidItem.institutionName,
      institutionUrl: a.plaidItem.institutionUrl,
      lastSyncedAt: a.plaidItem.lastSyncedAt,
      recentTransactions: a.transactions.map((t) => ({
        id: t.id,
        date: t.date,
        name: t.name,
        merchantName: t.merchantName,
        amount: Number(t.amount),
        pending: t.pending,
      })),
    })),
  };
}

/** Simple 30-day cash flow projection from the trailing 30 days of average daily net flow. */
export async function getCashFlowForecast(locationId: string) {
  const accounts = await prisma.bankAccount.findMany({ where: { locationId } });
  if (accounts.length === 0) return null;

  const currentBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const since = subDays(new Date(), 30);
  const transactions = await prisma.transaction.findMany({
    where: { bankAccount: { locationId }, date: { gte: since }, pending: false },
  });

  // Plaid convention: positive amount = money out, negative = money in.
  const netOutflow30d = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const avgDailyNetOutflow = netOutflow30d / 30;

  const projection = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    return {
      day,
      projectedBalance: Math.round((currentBalance - avgDailyNetOutflow * day) * 100) / 100,
    };
  });

  return { currentBalance, avgDailyNetOutflow: Math.round(avgDailyNetOutflow * 100) / 100, projection };
}

export async function createLinkToken(userId: string, locationId: string) {
  const client = getPlaidClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "OpsFlow AI",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: undefined,
  });
  void locationId;
  return response.data.link_token;
}

export async function exchangePublicToken(locationId: string, publicToken: string) {
  const client = getPlaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const itemResponse = await client.itemGet({ access_token: accessToken });
  const institutionId = itemResponse.data.item.institution_id;

  let institutionName: string | undefined;
  let institutionUrl: string | undefined;
  if (institutionId) {
    try {
      const institution = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = institution.data.institution.name;
      institutionUrl = institution.data.institution.url ?? undefined;
    } catch {
      // Institution metadata is best-effort; proceed without it.
    }
  }

  const plaidItem = await prisma.plaidItem.create({
    data: {
      locationId,
      itemId,
      accessTokenEnc: encryptSecret(accessToken),
      institutionName,
      institutionUrl,
      lastSyncedAt: new Date(),
    },
  });

  const accountsResponse = await client.accountsGet({ access_token: accessToken });
  for (const account of accountsResponse.data.accounts) {
    await prisma.bankAccount.create({
      data: {
        locationId,
        plaidItemId: plaidItem.id,
        plaidAccountId: account.account_id,
        name: account.name,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        currentBalance: account.balances.current ?? 0,
        availableBalance: account.balances.available,
        isoCurrencyCode: account.balances.iso_currency_code ?? "USD",
      },
    });
  }

  await syncTransactions(plaidItem.id);
  return plaidItem;
}

export async function syncTransactions(plaidItemId: string) {
  const client = getPlaidClient();
  const plaidItem = await prisma.plaidItem.findUniqueOrThrow({ where: { id: plaidItemId } });
  const accessToken = decryptSecret(plaidItem.accessTokenEnc);

  const accountsResponse = await client.accountsGet({ access_token: accessToken });
  const bankAccounts = await prisma.bankAccount.findMany({ where: { plaidItemId } });
  const byPlaidId = new Map(bankAccounts.map((a) => [a.plaidAccountId, a]));

  for (const account of accountsResponse.data.accounts) {
    const existing = byPlaidId.get(account.account_id);
    if (existing) {
      await prisma.bankAccount.update({
        where: { id: existing.id },
        data: {
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available,
        },
      });
    }
  }

  const transactionsResponse = await client.transactionsGet({
    access_token: accessToken,
    start_date: subDays(new Date(), 90).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
  });

  for (const tx of transactionsResponse.data.transactions) {
    const bankAccount = byPlaidId.get(tx.account_id);
    if (!bankAccount) continue;
    await prisma.transaction.upsert({
      where: { plaidTransactionId: tx.transaction_id },
      create: {
        bankAccountId: bankAccount.id,
        plaidTransactionId: tx.transaction_id,
        amount: tx.amount,
        isoCurrencyCode: tx.iso_currency_code ?? "USD",
        date: new Date(tx.date),
        name: tx.name,
        merchantName: tx.merchant_name,
        category: tx.personal_finance_category?.primary ?? tx.category?.[0],
        pending: tx.pending,
      },
      update: {
        amount: tx.amount,
        pending: tx.pending,
      },
    });
  }

  await prisma.plaidItem.update({ where: { id: plaidItemId }, data: { lastSyncedAt: new Date() } });
}

export async function disconnectBank(locationId: string, plaidItemId: string) {
  const plaidItem = await prisma.plaidItem.findFirstOrThrow({ where: { id: plaidItemId, locationId } });
  try {
    const client = getPlaidClient();
    const accessToken = decryptSecret(plaidItem.accessTokenEnc);
    await client.itemRemove({ access_token: accessToken });
  } catch {
    // Best-effort revoke; still mark disconnected locally either way.
  }
  await prisma.plaidItem.update({ where: { id: plaidItemId }, data: { status: "DISCONNECTED" } });
}
