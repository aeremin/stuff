import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { availableFields } from "../schema";
import { db, INVENTORY_COLLECTION } from "../firebase";
import { ItemForm } from "./ItemForm";
import "./ItemPage.css";
import type { InventoryItem } from "../common";

function itemToInitialValues(item: InventoryItem): Record<string, string> {
  const entries = availableFields.map((f) => {
    const v = item[f.id];
    if (v === null || v === undefined) return [f.id, ""];
    return [f.id, String(v)];
  });
  return Object.fromEntries(entries);
}

export function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchItem() {
      try {
        const docRef = doc(db!, INVENTORY_COLLECTION, id!);
        const docSnap = await getDoc(docRef);
        if (cancelled) return;
        if (docSnap.exists()) {
          setItem(docSnap.data() as InventoryItem);
          // Track that the user opened the edit page for this item.
          void updateDoc(docRef, { lastViewed: serverTimestamp() }).catch(
            () => {
              // Intentionally ignore write errors (view tracking is best-effort).
            },
          );
        } else {
          setItem(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load item");
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  return (
    <ItemForm
      key={item.id}
      initialValues={itemToInitialValues(item)}
      title="Edit item"
      submitLabel="Update item"
      backLink={
        <Link to={`/item/${id}`} className="item-page__back">
          ← Back to item
        </Link>
      }
      onSubmit={async (payload) => {
        const docRef = doc(db, INVENTORY_COLLECTION, id!);
        await updateDoc(docRef, {
          ...payload,
          lastEdited: serverTimestamp(),
        });
        navigate(`/item/${id}`);
      }}
    />
  );
}
