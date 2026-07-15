import OAuthClient from "intuit-oauth";

export function isQuickBooksConfigured() {
  return Boolean(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

export function getQuickBooksClient() {
  if (!isQuickBooksConfigured()) {
    throw new Error("QuickBooks isn't configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.");
  }
  return new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
  });
}
