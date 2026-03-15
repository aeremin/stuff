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
