/**
 * Item helpers shared by the MCP tools. Field definitions come from the web
 * app's src/schema.ts, so the server and the UI agree on what an item is.
 */
import { Timestamp } from "firebase-admin/firestore";
import {
  availableFields,
  isFieldVisibleForItemKind,
  ItemKind,
  type FieldDescriptor,
} from "../../src/schema.js";
import { itemUrl } from "./config.js";

export { availableFields, ItemKind };
export type { FieldDescriptor };

export const fieldsById = new Map(availableFields.map((f) => [f.id, f]));

export const itemKinds = Object.values(ItemKind) as [ItemKind, ...ItemKind[]];

export type StoredValue = string | number;

/** What the web form stores for a field left blank (or hidden for the kind). */
export function blankValue(field: FieldDescriptor): StoredValue {
  return field.type === "number" ? 0 : "";
}

/**
 * A complete set of blank fields, the same as the add form submits when
 * nothing is filled in. New items start from this so they look exactly like
 * items created in the web app.
 */
export function blankItem(): Record<string, StoredValue> {
  return Object.fromEntries(availableFields.map((f) => [f.id, blankValue(f)]));
}

/**
 * Turns validated tool arguments into Firestore field values for an item of
 * the given kind. `null` clears a field. Throws on fields the schema does not
 * know or that do not apply to the kind.
 */
export function toStoredFields(
  values: Record<string, unknown>,
  kind: string,
): Record<string, StoredValue> {
  const out: Record<string, StoredValue> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const field = fieldsById.get(key);
    if (!field) {
      throw new Error(
        `Unknown field "${key}". Known fields: ${[...fieldsById.keys()].join(", ")}.`,
      );
    }
    if (value !== null && !isFieldVisibleForItemKind(field, kind)) {
      throw new Error(
        `Field "${key}" only applies to items of kind ${field.onlyForKinds!
          .map((k) => `"${k}"`)
          .join(" or ")}, but this item's kind is ${kind ? `"${kind}"` : "not set"}.`,
      );
    }
    out[key] = value === null ? blankValue(field) : (value as StoredValue);
  }
  return out;
}

/**
 * Fields that the web form would blank when an item's kind changes to `kind`
 * (the form only submits fields that are visible for the selected kind).
 */
export function fieldsHiddenForKind(kind: string): Record<string, StoredValue> {
  return Object.fromEntries(
    availableFields
      .filter((f) => !isFieldVisibleForItemKind(f, kind))
      .map((f) => [f.id, blankValue(f)]),
  );
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function toPlain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toPlain(v)]),
    );
  }
  return value;
}

/** Full item for get/create/update results; blank fields are left out. */
export function serializeItem(
  id: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const kind = String(data.kind ?? "");
  const out: Record<string, unknown> = { id, url: itemUrl(id) };
  for (const field of availableFields) {
    const value = data[field.id];
    if (isBlank(value)) continue;
    // The web form saves a blank number as 0, so 0 usually means "not set".
    // An amount of 0 is real information (out of stock), unless the field
    // does not apply to the item at all.
    const keepZero = field.id === "amount" && isFieldVisibleForItemKind(field, kind);
    if (value === 0 && field.type === "number" && !keepZero) continue;
    out[field.id] = toPlain(value);
  }
  for (const [key, value] of Object.entries(data)) {
    if (fieldsById.has(key) || key === "id" || isBlank(value)) continue;
    out[key] = toPlain(value);
  }
  return out;
}

const SUMMARY_DESCRIPTION_LENGTH = 200;

/** Short form for search and list results. */
export function summarizeItem(
  id: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { id, name: data.name ?? "" };
  if (!isBlank(data.kind)) out.kind = data.kind;
  if (typeof data.amount === "number") out.amount = data.amount;
  if (typeof data.color === "string" && data.color.trim()) out.color = data.color;
  if (typeof data.description === "string" && data.description.trim()) {
    const d = data.description.trim();
    out.description =
      d.length > SUMMARY_DESCRIPTION_LENGTH
        ? `${d.slice(0, SUMMARY_DESCRIPTION_LENGTH)}…`
        : d;
  }
  if (data.lastEdited instanceof Timestamp) out.lastEdited = toPlain(data.lastEdited);
  out.url = itemUrl(id);
  return out;
}

export function describeSchema() {
  return {
    kinds: itemKinds,
    fields: availableFields.map((f) => ({
      id: f.id,
      name: f.humanReadableName,
      type: f.type,
      ...(f.allowedValues ? { allowedValues: f.allowedValues } : {}),
      ...(f.onlyForKinds?.length ? { onlyForKinds: f.onlyForKinds } : {}),
    })),
    notes: [
      "Fields with onlyForKinds can only be set on items of those kinds.",
      "Blank fields are stored as \"\" (text) or 0 (numbers), matching the web app. Item results leave out blank fields and zero numbers, except amount.",
      "Every item also has lastEdited and lastViewed timestamps, managed automatically.",
    ],
  };
}
