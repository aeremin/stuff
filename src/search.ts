import { auth } from "./firebase";
import type { InventoryItem } from "./common";

// Search goes through the Cloud Function (functions/src/search.ts), which
// checks the Firebase sign-in and queries Algolia with a key the browser never
// sees. In development, Vite proxies /api to the deployed function.

interface SearchResponse {
  items: Array<Record<string, unknown> & { id: string }>;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Not JSON; fall through.
  }
  return `Search failed (HTTP ${response.status}).`;
}

export async function searchItems(query: string): Promise<InventoryItem[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You are signed out. Sign in again to search.");
  }
  const idToken = await user.getIdToken();

  const response = await fetch("/api/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: trimmed, limit: 10 }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const { items } = (await response.json()) as SearchResponse;
  return items.map((item) => ({
    ...item,
    name: typeof item.name === "string" ? item.name : "",
  }));
}
