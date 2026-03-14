import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase";
import "./ItemPage.css";

const INVENTORY_COLLECTION = "items";

interface InventoryItem {
  id: string;
  [key: string]: unknown;
}

export function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    if (!db) {
      setError("Firebase is not configured. Add VITE_FIREBASE_* env vars.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchItem() {
      const docId = id;
      if (!docId) return;
      try {
        const docRef = doc(db!, INVENTORY_COLLECTION, docId);
        const docSnap = await getDoc(docRef);

        if (cancelled) {
          return;
        }

        if (docSnap.exists()) {
          setItem({
            id: docSnap.id,
            ...docSnap.data(),
          });
        } else {
          setItem(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load item");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchItem();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="item-page">
        <div className="item-page__loading">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="item-page">
        <div className="item-page__error">{error}</div>
        <Link to="/" className="item-page__back">
          ← Back to home
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="item-page">
        <div className="item-page__not-found">Item not found</div>
        <Link to="/" className="item-page__back">
          ← Back to home
        </Link>
      </div>
    );
  }

  const { id: _docId, ...fields } = item;

  return (
    <div className="item-page">
      <div className="item-page__header">
        <Link to="/" className="item-page__back">
          ← Back to home
        </Link>
      </div>
      <div className="item-page__card">
        <h1 className="item-page__title">Item: {id}</h1>
        <dl className="item-page__fields">
          {Object.entries(fields).map(([key, value]) => (
            <div key={key} className="item-page__field">
              <dt className="item-page__field-key">{key}</dt>
              <dd className="item-page__field-value">
                {value !== null && typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value ?? "")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
