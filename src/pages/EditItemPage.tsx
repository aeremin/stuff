import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Link, useNavigate, useParams } from "react-router-dom";
import { availableFields } from "../schema";
import { db, INVENTORY_COLLECTION } from "../firebase";
import { ItemLoadStatus } from "../components/ItemLoadStatus";
import { useItem } from "../useItem";
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
  const state = useItem(id);

  if (state.status !== "loaded") {
    return <ItemLoadStatus state={state} />;
  }
  const { item } = state;

  return (
    <ItemForm
      key={item.id}
      initialValues={itemToInitialValues(item)}
      title="Edit item"
      submitLabel="Update item"
      backLink={
        <Link to={`/item/${item.id}`} className="item-page__back">
          ← Back to item
        </Link>
      }
      onSubmit={async (payload) => {
        const docRef = doc(db, INVENTORY_COLLECTION, item.id);
        await updateDoc(docRef, {
          ...payload,
          lastEdited: serverTimestamp(),
        });
        navigate(`/item/${item.id}`);
      }}
    />
  );
}
