import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { MarkdownView } from "../components/MarkdownView";
import { searchItems } from "../algolia";
import { db, INVENTORY_COLLECTION } from "../firebase";
import type { InventoryItem } from "../common";

export function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [lastViewedItems, setLastViewedItems] = useState<InventoryItem[]>(
    [],
  );
  const [lastViewedLoading, setLastViewedLoading] = useState(true);
  const [lastViewedError, setLastViewedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLastViewed() {
      setLastViewedLoading(true);
      setLastViewedError(null);
      try {
        const q = query(
          collection(db!, INVENTORY_COLLECTION),
          orderBy("lastViewed", "desc"),
          limit(5),
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        const results = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const name =
            typeof data.name === "string" ? data.name : "(no name)";
          return { id: d.id, ...data, name } as InventoryItem;
        });
        setLastViewedItems(results);
      } catch (err) {
        if (!cancelled) {
          setLastViewedError(
            err instanceof Error
              ? err.message
              : "Failed to load last viewed items.",
          );
        }
      } finally {
        if (!cancelled) setLastViewedLoading(false);
      }
    }

    fetchLastViewed();
    return () => {
      cancelled = true;
    };
  }, []);

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
        const results = await searchItems(trimmed);

        if (cancelled) {
          return;
        }

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
          <span className="home__section-title">Search items</span>
          <input
            type="text"
            className="home__search-input"
            placeholder="Search by name or description…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>

      {!searchTerm.trim() && (
        <div>
          <h2 className="home__section-title">Last viewed</h2>
          <div className="home__results">
            {lastViewedLoading && <p className="home__status">Loading…</p>}
            {lastViewedError && (
              <p className="home__status home__status--error">
                {lastViewedError}
              </p>
            )}
            {!lastViewedLoading && !lastViewedError && lastViewedItems.length === 0 && (
              <p className="home__status">No recently viewed items.</p>
            )}
            {!lastViewedLoading && !lastViewedError && lastViewedItems.length > 0 && (
              <ul className="home__list">
                {lastViewedItems.map((item) => {
                  const name =
                    (item.name as string | undefined) ?? "(no name)";
                  const description =
                    (item["description"] as string | undefined) ?? "";
                  return (
                    <li key={item.id} className="home__list-item">
                      <div className="home__list-item-card">
                        <Link
                          to={`/item/${item.id}`}
                          className="home__item-link"
                        >
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
        </div>
      )}

      {searchTerm.trim() && (
        <div className="home__results">
          {loading && <p className="home__status">Searching…</p>}
          {error && <p className="home__status home__status--error">{error}</p>}
          {!loading && !error && hasSearched && items.length === 0 && (
            <p className="home__status">No items match your search.</p>
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
