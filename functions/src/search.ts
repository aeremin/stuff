/**
 * Algolia search, run only on the server.
 *
 * The Algolia index holds a copy of the whole inventory, and Algolia knows
 * nothing about the Firestore rules: anyone holding a search key can read
 * every record. So no key goes to the browser. The key lives in Secret
 * Manager, and both MCP search (tools.ts) and the web app's home page (through
 * POST /api/search below) search through this module.
 */
import express, { type Router } from "express";
import { algoliasearch, type Algoliasearch } from "algoliasearch";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";
import { checkIdToken } from "./access.js";
import { ALGOLIA } from "./config.js";

/** Search-only key for the index, set with `firebase functions:secrets:set`. */
export const algoliaSearchKey = defineSecret("ALGOLIA_SEARCH_KEY");

export type SearchHit = Record<string, unknown> & { objectID: string };

let client: Algoliasearch | undefined;

// Secret values are only readable while handling a request, so the client
// is created on first use and then reused by the instance.
function searchClient(): Algoliasearch {
  client ??= algoliasearch(ALGOLIA.appId, algoliaSearchKey.value());
  return client;
}

/** Full-text search; hits come without Algolia's own `_…` fields. */
export async function searchIndex(
  query: string,
  limit: number,
): Promise<{ totalHits: number; hits: SearchHit[] }> {
  const response = await searchClient().searchSingleIndex<Record<string, unknown>>({
    indexName: ALGOLIA.indexName,
    searchParams: {
      query,
      hitsPerPage: limit,
      attributesToHighlight: [],
      attributesToSnippet: [],
    },
  });
  const hits = response.hits.map((hit) => {
    const clean: SearchHit = { objectID: hit.objectID };
    for (const [key, value] of Object.entries(hit)) {
      if (!key.startsWith("_")) clean[key] = value;
    }
    return clean;
  });
  return { totalHits: response.nbHits ?? hits.length, hits };
}

const searchRequest = z.object({
  query: z.string().trim().min(1).max(512),
  limit: z.number().int().min(1).max(50).default(10),
});

/**
 * Search for the web app, mounted at /api. The caller sends their Firebase ID
 * token as a bearer token and must have the admin claim, as for the Firestore
 * rules (see access.ts).
 */
export function searchRouter(): Router {
  const router = express.Router();

  router.post("/search", express.json({ limit: "10kb" }), async (req, res) => {
    res.set("Cache-Control", "private, no-store");

    const header = req.get("Authorization") ?? "";
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) {
      return void res.status(401).json({ error: "Sign in to search." });
    }
    const access = await checkIdToken(match[1], "search");
    if (!access.ok) {
      return void res.status(access.status).json({ error: access.error });
    }

    const parsed = searchRequest.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({ error: "Invalid search request." });
    }

    try {
      const { totalHits, hits } = await searchIndex(parsed.data.query, parsed.data.limit);
      const items = hits.map(({ objectID, ...fields }) => ({ ...fields, id: objectID }));
      res.json({ totalHits, items });
    } catch (err) {
      logger.error("Algolia search failed", err);
      res.status(502).json({ error: "Search is unavailable right now." });
    }
  });

  return router;
}
