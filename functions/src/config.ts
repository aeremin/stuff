/**
 * Public origin of the app. The MCP server and its OAuth endpoints are served
 * from the same Firebase Hosting site as the web app (see the rewrites in
 * firebase.json), so this is both the OAuth issuer and the MCP resource.
 *
 * PUBLIC_BASE_URL can override it for the emulator (e.g. http://localhost:5000).
 */
export const BASE_URL = new URL(
  process.env.PUBLIC_BASE_URL ?? "https://stuff-11062.web.app",
);

export const MCP_URL = new URL("/mcp", BASE_URL);

/** Page in the web app where the signed-in user approves an MCP client. */
export const CONSENT_PAGE_URL = new URL("/connect", BASE_URL);

export function itemUrl(id: string): string {
  return new URL(`/item/${encodeURIComponent(id)}`, BASE_URL).toString();
}

/**
 * Accounts that may connect. Keep in sync with firestore.rules and
 * storage.rules: the function uses the Admin SDK, which bypasses those rules,
 * so this list is what actually guards the data.
 */
export const ALLOWED_EMAILS = new Set([
  "a.eremin.msu@gmail.com",
  "j.lotova@gmail.com",
]);

export const ITEMS_COLLECTION = "items";

export const OAUTH_COLLECTIONS = {
  clients: "mcpClients",
  requests: "mcpAuthRequests",
  codes: "mcpAuthCodes",
  tokens: "mcpTokens",
} as const;

export const AUTH_REQUEST_TTL_SECONDS = 10 * 60;
export const AUTH_CODE_TTL_SECONDS = 5 * 60;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

export const ALGOLIA = {
  appId: "214OQAKW3R",
  searchKey: "0c6b5fa50ab0cf1463491a433316238c",
  indexName: "global",
};
