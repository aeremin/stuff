import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarkdownView } from "../components/MarkdownView";
import { db, INVENTORY_COLLECTION } from "../firebase";
import type { InventoryItem } from "../common";

function buildNamePrefixBounds(term: string): [string, string] {
  const trimmed = term.trim();
  if (!trimmed) {
    return ["", ""];
  }
  const lower = trimmed;
  // Firestore prefix search pattern: [term, term + \uf8ff]
  const upper = `${lower}\uf8ff`;
  return [lower, upper];
}

export function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const trimmed = searchTerm.trim();

    if (!trimmed) {
      setItems([]);
      setLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    let cancelled = false;
    setHasSearched(true);
    setLoading(true);
    setError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const [lower, upper] = buildNamePrefixBounds(trimmed);
        if (!db) {
          throw new Error("Database is not configured.");
        }

        const colRef = collection(db, INVENTORY_COLLECTION);
        const q = query(
          colRef,
          orderBy("name"),
          where("name", ">=", lower),
          where("name", "<=", upper),
          limit(10),
        );

        const snapshot = await getDocs(q);

        if (cancelled) {
          return;
        }

        const results: InventoryItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<InventoryItem, "id">;
          return {
            id: docSnap.id,
            ...data,
          } as InventoryItem;
        });

        setItems(results);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to search items.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  return (
    <div className="home">
      <div className="home__header-row">
        <h1 className="home__title">Your inventory</h1>
        <Link to="/add" className="home__add-link">
          + Add new item
        </Link>
      </div>

      <div className="home__search">
        <label className="home__search-label">
          <span className="home__search-label-text">Search by name</span>
          <input
            type="text"
            className="home__search-input"
            placeholder="Start typing item name…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>

      {!searchTerm.trim() && (
        <p className="home__hint">Type a name to search your items.</p>
      )}

      {searchTerm.trim() && (
        <div className="home__results">
          {loading && <p className="home__status">Searching…</p>}
          {error && <p className="home__status home__status--error">{error}</p>}
          {!loading && !error && hasSearched && items.length === 0 && (
            <p className="home__status">No items match this name.</p>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="home__list">
              {items.map((item) => {
                const name = (item.name as string | undefined) ?? "(no name)";
                const description =
                  (item["description"] as string | undefined) ?? "";
                return (
                  <li key={item.id} className="home__list-item">
                    <div className="home__list-item-card">
                      <Link to={`/item/${item.id}`} className="home__item-link">
                        <span className="home__item-name">{name}</span>
                      </Link>
                      {description.trim() !== "" && (
                        <MarkdownView
                          markdown={description}
                          className="home__item-description markdown-view--compact"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

