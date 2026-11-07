export const ItemKind = {
  Screw: "Screw",
  Filament: "Filament",
  Tool: "Tool",
  ElectronicPart: "Electronic part",
  Device: "Device",
  Lego: "Lego",
  Climbing: "Climbing",
  Other: "Other",
} as const;

export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];

export interface FieldDescriptor {
  id: string;
  humanReadableName: string;
  type: "number" | "string" | "markdown" | "url" | "image" | "select";
  onlyForKinds?: ItemKind[];
  allowedValues?: string[];
}

export interface FieldValue {
  id: string;
  value: number | string;
}

export type Field = FieldDescriptor | FieldValue;

export function isFieldVisibleForItemKind(
  field: FieldDescriptor,
  kind: string,
): boolean {
  const restricted = field.onlyForKinds;
  if (!restricted?.length) return true;
  if (!kind) return false;
  return restricted.includes(kind as ItemKind);
}

export const availableFields: FieldDescriptor[] = [
  {
    id: "name",
    humanReadableName: "Name",
    type: "string",
  },
  {
    id: "kind",
    humanReadableName: "Kind",
    type: "select",
    allowedValues: Object.values(ItemKind),
  },

  {
    id: "shank_diameter",
    humanReadableName: "Shank diameter",
    type: "number",
    onlyForKinds: [ItemKind.Screw],
  },
  {
    id: "nominal_length",
    humanReadableName: "Nominal length",
    type: "number",
    onlyForKinds: [ItemKind.Screw],
  },
  {
    id: "drive_type",
    humanReadableName: "Drive type",
    type: "select",
    allowedValues: ["Phillips", "Torx", "Slot", "Hex"],
    onlyForKinds: [ItemKind.Screw],
  },
  {
    id: "drive_size",
    humanReadableName: "Drive size",
    type: "number",
    onlyForKinds: [ItemKind.Screw],
  },

  {
    id: "color",
    humanReadableName: "Color",
    type: "string",
    onlyForKinds: [ItemKind.Filament],
  },
  {
    id: "description",
    humanReadableName: "Description",
    type: "markdown",
  },
  {
    id: "buying_url",
    humanReadableName: "Shopping URL",
    type: "url",
  },
  {
    id: "original_price_per_piece",
    humanReadableName: "Original price (p/p)",
    type: "number",
  },
  {
    id: "info_url",
    humanReadableName: "Info URL",
    type: "url",
  },
  {
    id: "amount",
    humanReadableName: "Amount",
    type: "number",
  },
  {
    id: "weight_per_piece",
    humanReadableName: "Weight (p/p)",
    type: "number",
  },
  {
    id: "photo",
    humanReadableName: "Photo",
    type: "image",
  },
  {
    id: "set_number",
    humanReadableName: "Set number",
    type: "number",
    onlyForKinds: ["Lego"],
  },
  {
    id: "climbing_type",
    humanReadableName: "Gear type",
    type: "select",
    allowedValues: [
      "Quickdraw",
      "Locking carabiner",
      "Non-locking carabiner",
      "Sling",
      "Personal anchor",
      "Rope",
      "Belay device",
      "Harness",
      "Helmet",
      "Protection",
      "Racking",
    ],
    onlyForKinds: [ItemKind.Climbing],
  },
  {
    id: "length",
    humanReadableName: "Length, cm",
    type: "number",
    onlyForKinds: [ItemKind.Climbing],
  },
  {
    id: "manufacture_year",
    humanReadableName: "Manufacture year",
    type: "number",
    onlyForKinds: [ItemKind.Climbing],
  },
];

/**
 * Item key holding thumbnails of the item's image fields, keyed by field id
 * (`thumbnails.photo`). They are made by the `itemThumbnails` Cloud Function
 * (functions/src/thumbnails.ts) whenever an image field changes; nothing else
 * writes them.
 */
export const THUMBNAILS_KEY = "thumbnails";

export interface Thumbnail {
  /** The image URL the thumbnail was made from. */
  source: string;
  /** Download URL of the thumbnail; missing if it could not be made. */
  url?: string;
  /** Storage path of the thumbnail, so it can be deleted when replaced. */
  path?: string;
  /** Why the thumbnail could not be made. */
  error?: string;
}

/**
 * The thumbnail of an item's image field, if there is one and it was made
 * from the field's current value (right after the photo changes, the old
 * thumbnail lingers until the function replaces it).
 */
export function thumbnailUrl(
  item: Record<string, unknown>,
  fieldId: string,
): string | undefined {
  const thumbnails = item[THUMBNAILS_KEY];
  if (!thumbnails || typeof thumbnails !== "object") return undefined;
  const thumbnail = (thumbnails as Record<string, Partial<Thumbnail>>)[fieldId];
  const source = item[fieldId];
  if (
    typeof source !== "string" ||
    source.trim() === "" ||
    thumbnail?.source !== source.trim() ||
    typeof thumbnail.url !== "string"
  ) {
    return undefined;
  }
  return thumbnail.url;
}
