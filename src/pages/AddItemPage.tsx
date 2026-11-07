import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { availableFields } from "../schema";
import { db, INVENTORY_COLLECTION } from "../firebase";
import { ItemForm } from "./ItemForm";
import { BackToHomeLink } from "../components/BackToHomeLink";

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
        <BackToHomeLink />
      }
      onSubmit={async (payload) => {
        const docRef = await addDoc(
          collection(db, INVENTORY_COLLECTION),
          {
            ...payload,
            lastEdited: serverTimestamp(),
            lastViewed: serverTimestamp(),
          },
        );
        navigate(`/item/${docRef.id}`);
      }}
    />
  );
}
