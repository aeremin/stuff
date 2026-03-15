import { addDoc, collection } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { availableFields } from "../schema";
import { db } from "../firebase";
import { ItemForm } from "./ItemForm";

const INVENTORY_COLLECTION = "items";

const initialValues = Object.fromEntries(
  availableFields.map((f) => [f.id, ""]),
);

export function AddItemPage() {
  const navigate = useNavigate();

  if (!db) {
    return (
      <div className="item-page">
        <div className="item-page__error">
          Firebase is not configured. Add VITE_FIREBASE_* env vars.
        </div>
        <Link to="/" className="item-page__back">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <ItemForm
      initialValues={initialValues}
      title="Add new item"
      submitLabel="Save item"
      backLink={
        <Link to="/" className="item-page__back">
          ← Back to home
        </Link>
      }
      onSubmit={async (payload) => {
        const docRef = await addDoc(
          collection(db, INVENTORY_COLLECTION),
          payload,
        );
        navigate(`/item/${docRef.id}`);
      }}
    />
  );
}
