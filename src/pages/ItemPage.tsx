import { deleteDoc, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db, INVENTORY_COLLECTION } from "../firebase";
import { ItemLoadStatus } from "../components/ItemLoadStatus";
import { MarkdownView } from "../components/MarkdownView";
import {
  availableFields,
  isFieldVisibleForItemKind,
  THUMBNAILS_KEY,
  thumbnailUrl,
} from "../schema";
import type { FieldDescriptor } from "../schema";
import { useItem } from "../useItem";
import "./ItemPage.css";
import { BackToHomeLink, homeLocation } from "../components/BackToHomeLink";

export function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useItem(id);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcWriting, setNfcWriting] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<string | null>(null);

  useEffect(() => {
    if (window.NDEFReader != undefined) {
      setNfcSupported(true);
    }
  }, []);

  const handleWriteNfc = async () => {
    setNfcStatus(null);

    try {
      setNfcWriting(true);

      const ndef = new window.NDEFReader();
      const url = window.location.href;
      await ndef.write({ records: [{ recordType: "url", data: url }] });
      setNfcStatus(
        "Page address has been written to the NFC tag. You can now remove the tag.",
      );
    } catch (err) {
      setNfcStatus(
        err instanceof Error ? err.message : "Failed to write to NFC tag.",
      );
    } finally {
      setNfcWriting(false);
    }
  };

  if (state.status !== "loaded") {
    return <ItemLoadStatus state={state} />;
  }
  const { item } = state;

  // The itemThumbnails function deletes the item's thumbnails once the
  // document is gone.
  const handleDelete = async () => {
    const name = String(item["name"] ?? "").trim() || "this item";
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteDoc(doc(db, INVENTORY_COLLECTION, item.id));
      // Replace the history entry, so Back does not return to a deleted item.
      navigate(homeLocation(), { replace: true });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete item.",
      );
      setDeleting(false);
    }
  };

  const knownFieldIds = new Set(availableFields.map((f) => f.id));
  const extraKeys = Object.keys(item).filter(
    (k) =>
      k !== "id" &&
      k !== "lastEdited" &&
      k !== "lastViewed" &&
      k !== THUMBNAILS_KEY &&
      !knownFieldIds.has(k),
  );
  const itemKind = String(item["kind"] ?? "");

  function renderFieldValue(
    value: unknown,
    field: FieldDescriptor,
  ): React.ReactNode {
    const { type } = field;
    if (value === null || value === undefined) return "";
    if (type === "image" && typeof value === "string" && value.trim() !== "") {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="item-page__field-image-link"
        >
          {/* The full photo stands in until the thumbnail exists (just after
              the photo changed) or if it could not be made. The link always
              opens the full photo. */}
          <img
            src={thumbnailUrl(item, field.id) ?? value}
            alt=""
            className="item-page__field-image-thumb"
            loading="lazy"
          />
        </a>
      );
    }
    if (type === "image") return "";
    if (type === "url" && typeof value === "string" && value.trim() !== "") {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="item-page__field-link"
        >
          {value}
        </a>
      );
    }
    if (
      type === "markdown" &&
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      return (
        <MarkdownView markdown={value} className="item-page__markdown" />
      );
    }
    if (type === "markdown") return "";
    if (value !== null && typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  return (
    <div className="item-page">
      <div className="item-page__header">
        <BackToHomeLink />
      </div>
      <div className="item-page__card">
        <h1 className="item-page__title">{item["name"] as string}</h1>
        <div className="item-page__actions">
          <Link
            to={`/item/${item.id}/edit`}
            className="item-page__nfc-button item-page__edit-button"
          >
            Edit
          </Link>
          {nfcSupported && (
            <div>
              <button
                type="button"
                className="item-page__nfc-button"
                onClick={handleWriteNfc}
                disabled={!nfcSupported || nfcWriting}
              >
                {nfcWriting ? "Tap NFC tag…" : "Write this page to NFC tag"}
              </button>
              {nfcStatus && (
                <p className="item-page__nfc-status">{nfcStatus}</p>
              )}
            </div>
          )}
          <button
            type="button"
            className="item-page__nfc-button item-page__delete-button"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        {deleteError && (
          <div className="item-page__error item-page__delete-error">
            {deleteError}
          </div>
        )}
        <dl className="item-page__fields">
          {availableFields.map((field) => {
            if (!isFieldVisibleForItemKind(field, itemKind)) return null;
            if (!(field.id in item)) return null;
            const value = item[field.id];
            return (
              <div
                key={field.id}
                className={
                  field.type === "markdown"
                    ? "item-page__field item-page__field--markdown"
                    : "item-page__field"
                }
              >
                <dt className="item-page__field-key">
                  {field.humanReadableName}
                </dt>
                <dd className="item-page__field-value">
                  {renderFieldValue(value, field)}
                </dd>
              </div>
            );
          })}
          {extraKeys.map((key) => {
            const value = item[key];
            return (
              <div key={key} className="item-page__field">
                <dt className="item-page__field-key">{key}</dt>
                <dd className="item-page__field-value">
                  {value !== null && typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value ?? "")}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
