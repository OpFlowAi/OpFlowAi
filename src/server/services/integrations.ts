import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import OAuthClient from "intuit-oauth";
import { getQuickBooksClient, isQuickBooksConfigured } from "@/lib/integrations/quickbooks-client";
import { getGoogleAuthUrl, getGoogleOAuthClient, getSheetsClient, isGoogleConfigured } from "@/lib/integrations/google-client";
import { listInventory } from "@/server/services/inventory";
import type { IntegrationProvider } from "@prisma/client";

export { isQuickBooksConfigured, isGoogleConfigured };

export async function getIntegrationsStatus(locationId: string) {
  const connections = await prisma.integrationConnection.findMany({ where: { locationId } });
  const byProvider = (p: IntegrationProvider) => connections.find((c) => c.provider === p) ?? null;
  return {
    quickbooks: byProvider("QUICKBOOKS"),
    googleSheets: byProvider("GOOGLE_SHEETS"),
  };
}

// ---------------------------------------------------------------------------
// QuickBooks
// ---------------------------------------------------------------------------

export function quickbooksAuthUrl(state: string) {
  const client = getQuickBooksClient();
  return client.authorizeUri({ scope: [OAuthClient.scopes.Accounting], state });
}

export async function quickbooksHandleCallback(callbackUrl: string, locationId: string, userId: string) {
  const client = getQuickBooksClient();
  const authResponse = await client.createToken(callbackUrl);
  const token = authResponse.getToken();

  await prisma.integrationConnection.upsert({
    where: { locationId_provider: { locationId, provider: "QUICKBOOKS" } },
    create: {
      locationId,
      provider: "QUICKBOOKS",
      status: "CONNECTED",
      externalId: token.realmId,
      accessTokenEnc: encryptSecret(token.access_token!),
      refreshTokenEnc: encryptSecret(token.refresh_token!),
      expiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000),
      connectedById: userId,
      lastSyncedAt: new Date(),
    },
    update: {
      status: "CONNECTED",
      externalId: token.realmId,
      accessTokenEnc: encryptSecret(token.access_token!),
      refreshTokenEnc: encryptSecret(token.refresh_token!),
      expiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000),
      connectedById: userId,
      lastSyncedAt: new Date(),
    },
  });
}

export async function quickbooksSyncCompanyInfo(locationId: string) {
  const connection = await prisma.integrationConnection.findUniqueOrThrow({
    where: { locationId_provider: { locationId, provider: "QUICKBOOKS" } },
  });
  const client = getQuickBooksClient();
  client.setToken({
    access_token: decryptSecret(connection.accessTokenEnc!),
    refresh_token: decryptSecret(connection.refreshTokenEnc!),
    realmId: connection.externalId!,
  });

  const base = client.environment === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
  const response = await client.makeApiCall({
    url: `${base}/v3/company/${connection.externalId}/companyinfo/${connection.externalId}`,
  });
  const companyName = response.json?.CompanyInfo?.CompanyName ?? null;

  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date(), metadata: { companyName } },
  });
  return companyName;
}

// ---------------------------------------------------------------------------
// Google Sheets
// ---------------------------------------------------------------------------

export function googleAuthUrl(state: string) {
  return getGoogleAuthUrl(state);
}

export async function googleHandleCallback(code: string, locationId: string, userId: string) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);

  await prisma.integrationConnection.upsert({
    where: { locationId_provider: { locationId, provider: "GOOGLE_SHEETS" } },
    create: {
      locationId,
      provider: "GOOGLE_SHEETS",
      status: "CONNECTED",
      accessTokenEnc: encryptSecret(tokens.access_token!),
      refreshTokenEnc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      connectedById: userId,
      lastSyncedAt: new Date(),
    },
    update: {
      status: "CONNECTED",
      accessTokenEnc: encryptSecret(tokens.access_token!),
      ...(tokens.refresh_token ? { refreshTokenEnc: encryptSecret(tokens.refresh_token) } : {}),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      connectedById: userId,
      lastSyncedAt: new Date(),
    },
  });
}

export async function googleSetSpreadsheet(locationId: string, spreadsheetId: string) {
  await prisma.integrationConnection.update({
    where: { locationId_provider: { locationId, provider: "GOOGLE_SHEETS" } },
    data: { externalId: spreadsheetId },
  });
}

export async function googleSyncInventoryToSheet(locationId: string) {
  const connection = await prisma.integrationConnection.findUniqueOrThrow({
    where: { locationId_provider: { locationId, provider: "GOOGLE_SHEETS" } },
  });
  if (!connection.externalId) throw new Error("No spreadsheet connected yet");

  const sheets = getSheetsClient(
    decryptSecret(connection.accessTokenEnc!),
    decryptSecret(connection.refreshTokenEnc!)
  );
  const items = await listInventory(locationId);

  const header = ["Name", "Category", "Unit", "Current Stock", "Par Level", "Reorder Point", "Unit Cost", "Status"];
  const rows = items.map((i) => [
    i.name,
    i.category.name,
    i.unit,
    i.currentStock,
    i.parLevel,
    i.reorderPoint,
    i.unitCost,
    i.status,
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: connection.externalId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: { values: [header, ...rows] },
  });

  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  });
  return items.length;
}

// ---------------------------------------------------------------------------

export async function disconnectIntegration(locationId: string, provider: IntegrationProvider) {
  await prisma.integrationConnection.update({
    where: { locationId_provider: { locationId, provider } },
    data: { status: "DISCONNECTED", accessTokenEnc: null, refreshTokenEnc: null },
  });
}
