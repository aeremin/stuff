import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QuerySnapshot,
} from "firebase/firestore";
import { rememberHomeSearch } from "../components/BackToHomeLink";
import { ItemList } from "../components/ItemList";
import { searchItems } from "../search";
import { db, INVENTORY_COLLECTION } from "../firebase";
import { ItemKind } from "../schema";
import type { InventoryItem } from "../common";

const itemKinds: string[] = Object.values(ItemKind);

function toItems(snap: QuerySnapshot): InventoryItem[] {
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name : "(no name)";
    return { id: d.id, ...data, name } as InventoryItem;
  });
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const kindParam = searchParams.get("kind") ?? "";
  const selectedKind = itemKinds.includes(kindParam) ? kindParam : "";
  const { search } = useLocation();

  useEffect(() => {
    rememberHomeSearch(search);
  }, [search]);

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
          collection(db, INVENTORY_COLLECTION),
          orderBy("lastViewed", "desc"),
          limit(5),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setLastViewedItems(toItems(snap));
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

  const [kindItems, setKindItems] = useState<InventoryItem[]>([]);
  const [kindLoading, setKindLoading] = useState(false);
  const [kindError, setKindError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedKind) {
      setKindItems([]);
      setKindError(null);
      setKindLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchKind() {
      setKindLoading(true);
      setKindError(null);
      try {
        // Equality only, so no composite index is needed; one kind of a
        // personal inventory is small enough to sort here.
        const q = query(
          collection(db, INVENTORY_COLLECTION),
          where("kind", "==", selectedKind),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const results = toItems(snap).sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
        setKindItems(results);
      } catch (err) {
        if (!cancelled) {
          setKindError(
            err instanceof Error ? err.message : "Failed to load items.",
          );
        }
      } finally {
        if (!cancelled) setKindLoading(false);
      }
    }

    fetchKind();
    return () => {
      cancelled = true;
    };
  }, [selectedKind]);

  const selectKind = (kind: string) => {
    setSearchTerm("");
    setSearchParams(kind && kind !== selectedKind ? { kind } : {});
  };

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

      <nav className="home__kinds" aria-label="Categories">
        {itemKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={
              "home__kind-chip" +
              (kind === selectedKind ? " home__kind-chip--active" : "")
            }
            aria-pressed={kind === selectedKind}
            onClick={() => selectKind(kind)}
          >
            {kind}
          </button>
        ))}
      </nav>

      {!searchTerm.trim() && selectedKind && (
        <div>
          <h2 className="home__section-title">
            {selectedKind}
            {!kindLoading && !kindError && (
              <span className="home__count"> · {kindItems.length}</span>
            )}
          </h2>
          <div className="home__results">
            {kindLoading && <p className="home__status">Loading…</p>}
            {kindError && (
              <p className="home__status home__status--error">{kindError}</p>
            )}
            {!kindLoading && !kindError && kindItems.length === 0 && (
              <p className="home__status">No items in this category.</p>
            )}
            {!kindLoading && !kindError && kindItems.length > 0 && (
              <ItemList items={kindItems} />
            )}
          </div>
        </div>
      )}

      {!searchTerm.trim() && !selectedKind && (
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
              <ItemList items={lastViewedItems} />
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
            <ItemList items={items} />
          )}
        </div>
      )}
    </div>
  );
}
