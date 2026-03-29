import { algoliasearch } from "algoliasearch";
import type { InventoryItem } from "./common";

const appId = "214OQAKW3R";
const searchKey = "0c6b5fa50ab0cf1463491a433316238c";
const indexName = "global";

function hitToItem(hit: Record<string, unknown> & { objectID: string }): InventoryItem {
  const item: Record<string, unknown> = { id: hit.objectID };
  for (const [key, value] of Object.entries(hit)) {
    if (key === "objectID" || key.startsWith("_")) {
      continue;
    }
    item[key] = value;
  }
  if (typeof item.name !== "string") {
    item.name = "";
  }
  return item as InventoryItem;
}

export async function searchItems(query: string): Promise<InventoryItem[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const client = algoliasearch(appId, searchKey);
  const response = await client.searchSingleIndex<Record<string, unknown>>({
    indexName,
    searchParams: {
      query: trimmed,
      hitsPerPage: 10,
    },
  });

  const hits = response.hits ?? [];
  return hits.map((hit) =>
    hitToItem(hit as Record<string, unknown> & { objectID: string }),
  );
}
