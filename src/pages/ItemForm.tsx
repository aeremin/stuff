import { useCallback, useState } from "react";
import { availableFields, isFieldVisibleForItemKind } from "../schema";
import type { FieldDescriptor } from "../schema";
import { uploadItemImage } from "../storageUpload";
import "./AddItemPage.css";
import "./ItemPage.css";

function getInputType(field: FieldDescriptor): "number" | "text" | "url" {
  if (field.type === "number") return "number";
  if (field.type === "url") return "url";
  return "text";
}

function SelectFieldInput(props: {
  field: FieldDescriptor;
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
}) {
  const { field, value, saving, onChange } = props;
  if (field.type !== "select") return null;
  const options = field.allowedValues ?? [];
  const valueNotListed = value !== "" && !options.includes(value);
  return (
    <select
      id={`add-item-${field.id}`}
      className="add-item-page__input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={saving}
    >
      <option value="">—</option>
      {valueNotListed ? <option value={value}>{value}</option> : null}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
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
  const [imageUploadingId, setImageUploadingId] = useState<string | null>(null);

  const setField = useCallback((id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, number | string> = {};
      const currentKind = values.kind ?? "";
      for (const field of availableFields) {
        const raw = isFieldVisibleForItemKind(field, currentKind)
          ? (values[field.id] ?? "")
          : "";
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
            {availableFields
              .filter((field) =>
                isFieldVisibleForItemKind(field, values.kind ?? ""),
              )
              .map((field) => (
              <div
                key={field.id}
                className={
                  field.type === "image"
                    ? "item-page__field add-item-page__field add-item-page__field--image"
                    : field.type === "markdown"
                      ? "item-page__field add-item-page__field add-item-page__field--markdown"
                      : "item-page__field add-item-page__field"
                }
              >
                <label
                  htmlFor={`add-item-${field.id}`}
                  className="item-page__field-key add-item-page__label"
                >
                  {field.humanReadableName}
                </label>
                {field.type === "markdown" ? (
                  <textarea
                    id={`add-item-${field.id}`}
                    className="add-item-page__input add-item-page__textarea"
                    rows={8}
                    value={values[field.id] ?? ""}
                    onChange={(e) => setField(field.id, e.target.value)}
                    disabled={saving}
                  />
                ) : field.type === "image" ? (
                  <div className="add-item-page__image-field">
                    {values[field.id]?.trim() ? (
                      <a
                        href={values[field.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="item-page__field-image-link"
                      >
                        <img
                          src={values[field.id]}
                          alt=""
                          className="item-page__field-image-thumb"
                        />
                      </a>
                    ) : null}
                    <div className="add-item-page__image-actions">
                      <input
                        id={`add-item-${field.id}`}
                        type="file"
                        accept="image/*;capture=camera"
                        className="add-item-page__file-input"
                        disabled={saving || imageUploadingId !== null}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setImageUploadingId(field.id);
                          setError(null);
                          try {
                            const url = await uploadItemImage(file);
                            setField(field.id, url);
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to upload image",
                            );
                          } finally {
                            setImageUploadingId(null);
                          }
                        }}
                      />
                      {values[field.id]?.trim() ? (
                        <button
                          type="button"
                          className="add-item-page__clear-image"
                          disabled={saving || imageUploadingId !== null}
                          onClick={() => setField(field.id, "")}
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                    {imageUploadingId === field.id ? (
                      <p className="add-item-page__image-status">Uploading…</p>
                    ) : null}
                  </div>
                ) : field.type === "select" ? (
                  <SelectFieldInput
                    field={field}
                    value={values[field.id] ?? ""}
                    saving={saving}
                    onChange={(v) => setField(field.id, v)}
                  />
                ) : (
                  <input
                    id={`add-item-${field.id}`}
                    type={getInputType(field)}
                    className="add-item-page__input"
                    value={values[field.id] ?? ""}
                    onChange={(e) => setField(field.id, e.target.value)}
                    disabled={saving}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="add-item-page__actions">
            <button
              type="submit"
              className="item-page__nfc-button add-item-page__submit"
              disabled={saving || imageUploadingId !== null}
            >
              {saving ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
