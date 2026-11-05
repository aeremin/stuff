import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { InventoryItem } from "./common";
import { db, INVENTORY_COLLECTION } from "./firebase";

export type ItemState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "notFound" }
  | { status: "loaded"; item: InventoryItem };

/**
 * Loads one item by its document id and records that it was viewed
 * (`lastViewed`, best-effort), so it shows up under "Last viewed".
 */
export function useItem(id: string | undefined): ItemState {
  const [state, setState] = useState<ItemState>({ status: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ status: "notFound" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const docRef = doc(db, INVENTORY_COLLECTION, id);
        const docSnap = await getDoc(docRef);
        if (cancelled) return;

        if (!docSnap.exists()) {
          setState({ status: "notFound" });
          return;
        }
        setState({
          status: "loaded",
          item: { ...docSnap.data(), id: docSnap.id } as InventoryItem,
        });
        void updateDoc(docRef, { lastViewed: serverTimestamp() }).catch(() => {
          // View tracking is best-effort; ignore write errors.
        });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load item",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
