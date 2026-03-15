import { useCallback, useState } from "react";
import { availableFields } from "../schema";
import type { FieldDescriptor } from "../schema";
import "./AddItemPage.css";

function getInputType(field: FieldDescriptor): "number" | "text" | "url" {
  if (field.type === "number") return "number";
  if (field.type === "url") return "url";
  return "text";
}

export interface ItemFormProps {
  initialValues: Record<string, string>;
  onSubmit: (payload: Record<string, number | string>) => Promise<void>;
  title: string;
  submitLabel: string;
  backLink: React.ReactNode;
}

export function ItemForm({
  initialValues,
  onSubmit,
  title,
  submitLabel,
  backLink,
}: ItemFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = useCallback((id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      await onSubmit(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save item",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="item-page add-item-page">
      <div className="item-page__header">{backLink}</div>
      <div className="item-page__card">
        <h1 className="item-page__title">{title}</h1>
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
              {saving ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
