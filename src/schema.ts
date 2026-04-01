export const ItemKind = {
  Screw: "Screw",
  Filament: "Filament",
  Tool: "Tool",
  ElectronicPart: "Electronic part",
  Device: "Device",
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
];
