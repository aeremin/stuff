import { addDoc, collection } from "firebase/firestore";
import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { availableFields } from "../schema";
import type { FieldDescriptor } from "../schema";
import { db } from "../firebase";
import "./AddItemPage.css";

const INVENTORY_COLLECTION = "items";

function getInputType(field: FieldDescriptor): "number" | "text" | "url" {
  if (field.type === "number") return "number";
  if (field.type === "url") return "url";
  return "text";
}

const initialValues: Record<string, string> = Object.fromEntries(
  availableFields.map((f) => [f.id, ""]),
);

export function AddItemPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = useCallback((id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!db) {
      setError("Firebase is not configured. Add VITE_FIREBASE_* env vars.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, number | string> = {};
      for (const field of availableFields) {
        const raw = values[field.id] ?? "";
        if (field.type === "number") {
          const num = Number(raw);
          payload[field.id] = Number.isNaN(num) ? 0 : num;
        } else {
          payload[field.id] = raw;
        }
      }

      const docRef = await addDoc(
        collection(db, INVENTORY_COLLECTION),
        payload,
      );
      navigate(`/item/${docRef.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save item",
      );
    } finally {
      setSaving(false);
    }
  };

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
    <div className="item-page add-item-page">
      <div className="item-page__header">
        <Link to="/" className="item-page__back">
          ← Back to home
        </Link>
      </div>
      <div className="item-page__card">
        <h1 className="item-page__title">Add new item</h1>
        {error && (
          <div className="item-page__error add-item-page__error">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="add-item-page__form">
          <div className="item-page__fields">
            {availableFields.map((field) => (
              <div key={field.id} className="item-page__field add-item-page__field">
                <label
                  htmlFor={`add-item-${field.id}`}
                  className="item-page__field-key add-item-page__label"
                >
                  {field.humanReadableName}
                </label>
                <input
                  id={`add-item-${field.id}`}
                  type={getInputType(field)}
                  className="add-item-page__input"
                  value={values[field.id] ?? ""}
                  onChange={(e) => setField(field.id, e.target.value)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
          <div className="add-item-page__actions">
            <button
              type="submit"
              className="item-page__nfc-button add-item-page__submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
