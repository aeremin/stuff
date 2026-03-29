export interface FieldDescriptor {
  id: string;
  humanReadableName: string;
  type: "number" | "string" | "markdown" | "url" | "image";
}

export interface FieldValue {
  id: string;
  value: number | string;
}

export type Field = FieldDescriptor | FieldValue;

export const availableFields: FieldDescriptor[] = [
  {
    id: "name",
    humanReadableName: "Name",
    type: "string",
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
