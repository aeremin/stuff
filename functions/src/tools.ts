import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ITEMS_COLLECTION } from "./config.js";
import { bucket, db } from "./firebase.js";
import {
  availableFields,
  blankItem,
  describeSchema,
  fieldsById,
  fieldsHiddenForKind,
  itemKinds,
  serializeItem,
  summarizeItem,
  toStoredFields,
  type FieldDescriptor,
} from "./items.js";
import { searchIndex } from "./search.js";

const INSTRUCTIONS = `This server manages "Stuff", a personal inventory of physical things: screws, 3D-printer filament, tools, electronic parts, devices, Lego sets, climbing gear and more.

Each item has a name, a kind and kind-specific fields (call describe_schema for the full list). To find an item, use search_items for free-text queries or list_items to browse by kind or recency, then get_item for every field. Use adjust_amount when stock is used up or restocked, so concurrent changes are not lost. Every result includes the item's URL in the web app.`;

const items = () => db.collection(ITEMS_COLLECTION);

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function fieldSchema(field: FieldDescriptor): z.ZodType {
  let schema: z.ZodType;
  let hint = "";
  switch (field.type) {
    case "number":
      schema = z.number();
      break;
    case "select":
      schema = z.enum(field.allowedValues as [string, ...string[]]);
      break;
    case "url":
      schema = z.url({ protocol: /^https?$/ });
      break;
    case "image":
      schema = z.url({ protocol: /^https?$/ });
      hint =
        " Image URL. To copy an image from the web into the app's own storage, use set_item_photo instead.";
      break;
    case "markdown":
      schema = z.string();
      hint = " Markdown.";
      break;
    default:
      schema = z.string();
  }
  const kinds = field.onlyForKinds?.length
    ? ` Only for kind ${field.onlyForKinds.map((k) => `"${k}"`).join(" or ")}.`
    : "";
  return schema.describe(`${field.humanReadableName}.${hint}${kinds}`);
}

const createShape: Record<string, z.ZodType> = Object.fromEntries(
  availableFields.map((f) => [
    f.id,
    f.id === "name" ? z.string().min(1).describe("Name.") : fieldSchema(f).optional(),
  ]),
);

const updateShape: Record<string, z.ZodType> = {
  id: z.string().min(1).describe("Item id."),
  ...Object.fromEntries(
    availableFields.map((f) => [
      f.id,
      f.id === "name"
        ? z.string().min(1).optional().describe("Name.")
        : fieldSchema(f).nullable().optional(),
    ]),
  ),
};

const idSchema = z.string().min(1).max(200).describe("Item id, as returned by search_items or list_items.");

function itemFields(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).filter(([key]) => fieldsById.has(key)),
  );
}

const PHOTO_FIELD = availableFields.find((f) => f.type === "image")?.id ?? "photo";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/heic": "heic",
};

async function storeImageFromUrl(source: string): Promise<string> {
  const response = await fetch(source, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "image/*" },
  });
  if (!response.ok) {
    throw new Error(`Downloading the image failed: HTTP ${response.status}`);
  }
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error(`The URL is not an image (content type "${contentType || "unknown"}").`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_PHOTO_BYTES) throw new Error("The image is larger than 10 MB.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error("The image is larger than 10 MB.");

  // Same layout and URL form as the web app's uploads (src/storageUpload.ts).
  const path = `item-images/${randomUUID()}.${IMAGE_EXTENSIONS[contentType] ?? "jpg"}`;
  const token = randomUUID();
  const file = bucket().file(path);
  await file.save(bytes, {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "stuff-inventory", title: "Stuff inventory", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "describe_schema",
    {
      title: "Describe item schema",
      description:
        "List the item kinds and every field an item can have, with types, allowed values and which kinds each field applies to.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(describeSchema()),
  );

  server.registerTool(
    "search_items",
    {
      title: "Search items",
      description:
        "Full-text search over item names, descriptions and other fields (the same search as the web app's home page). Returns short summaries; use get_item for all fields.",
      inputSchema: {
        query: z.string().min(1).describe("Search text, e.g. \"M3 torx 12\" or \"PLA black\"."),
        limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      const { totalHits, hits } = await searchIndex(query, limit);
      const results = hits.map((hit) => summarizeItem(hit.objectID, hit));
      return json({ totalHits, results });
    },
  );

  server.registerTool(
    "list_items",
    {
      title: "List items",
      description:
        "List items, optionally only those of one kind, sorted by most recently edited, most recently viewed, or name. Returns short summaries; use get_item for all fields.",
      inputSchema: {
        kind: z.enum(itemKinds).optional().describe("Only items of this kind."),
        sort_by: z
          .enum(["lastEdited", "lastViewed", "name"])
          .default("lastEdited")
          .describe("lastEdited and lastViewed sort newest first; name sorts A–Z."),
        limit: z.number().int().min(1).max(200).default(25).describe("Maximum number of items."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ kind, sort_by, limit }) => {
      const direction = sort_by === "name" ? "asc" : "desc";
      let docs;
      if (kind) {
        // Filtering and sorting on different fields would need a composite
        // index; one kind of a personal inventory is small, so sort here.
        const snap = await items().where("kind", "==", kind).get();
        docs = snap.docs.sort((a, b) => {
          const av = a.get(sort_by);
          const bv = b.get(sort_by);
          if (sort_by === "name") return String(av ?? "").localeCompare(String(bv ?? ""));
          const am = av instanceof Timestamp ? av.toMillis() : 0;
          const bm = bv instanceof Timestamp ? bv.toMillis() : 0;
          return bm - am;
        });
        docs = docs.slice(0, limit);
      } else {
        docs = (await items().orderBy(sort_by, direction).limit(limit).get()).docs;
      }
      return json({ items: docs.map((d) => summarizeItem(d.id, d.data())) });
    },
  );

  server.registerTool(
    "get_item",
    {
      title: "Get item",
      description: "Get every field of one item.",
      inputSchema: { id: idSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const snap = await items().doc(id).get();
      if (!snap.exists) return fail(`No item with id "${id}".`);
      return json(serializeItem(snap.id, snap.data()!));
    },
  );

  server.registerTool(
    "create_item",
    {
      title: "Create item",
      description:
        "Add a new item to the inventory. Set kind to unlock kind-specific fields (see describe_schema). Returns the new item with its id and URL.",
      inputSchema: createShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      const values = itemFields(args);
      const kind = typeof values.kind === "string" ? values.kind : "";
      let fields;
      try {
        fields = toStoredFields(values, kind);
      } catch (err) {
        return fail((err as Error).message);
      }
      const ref = await items().add({
        ...blankItem(),
        ...fields,
        lastEdited: FieldValue.serverTimestamp(),
        lastViewed: FieldValue.serverTimestamp(),
      });
      const snap = await ref.get();
      return json({ created: serializeItem(ref.id, snap.data()!) });
    },
  );

  server.registerTool(
    "update_item",
    {
      title: "Update item",
      description:
        "Change fields of an existing item. Only the fields you pass are changed; pass null to clear a field. Changing kind clears the fields that do not apply to the new kind, as the web app's edit form does. To change a stock count by a relative amount, prefer adjust_amount.",
      inputSchema: updateShape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const id = String(args.id);
      const values = itemFields(args);
      if (Object.values(values).every((v) => v === undefined)) {
        return fail("Pass at least one field to change.");
      }
      const ref = items().doc(id);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error(`No item with id "${id}".`);
          const currentKind = String(snap.get("kind") ?? "");
          const kindChanges = values.kind !== undefined;
          const kind = kindChanges ? String(values.kind ?? "") : currentKind;
          const update = {
            ...(kindChanges && kind !== currentKind ? fieldsHiddenForKind(kind) : {}),
            ...toStoredFields(values, kind),
            lastEdited: FieldValue.serverTimestamp(),
          };
          tx.update(ref, update);
        });
      } catch (err) {
        return fail((err as Error).message);
      }
      const snap = await ref.get();
      return json({ updated: serializeItem(id, snap.data()!) });
    },
  );

  server.registerTool(
    "adjust_amount",
    {
      title: "Adjust amount",
      description:
        "Add to or subtract from an item's amount (stock count), e.g. delta -4 after using four screws, or +1000 after buying a spool. The amount cannot go below zero.",
      inputSchema: {
        id: idSchema,
        delta: z.number().refine((n) => n !== 0, "delta must not be zero").describe("Change in amount; negative to use up, positive to restock."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ id, delta }) => {
      const ref = items().doc(id);
      try {
        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error(`No item with id "${id}".`);
          const raw = snap.get("amount");
          const previous = typeof raw === "number" ? raw : Number(raw) || 0;
          const amount = previous + delta;
          if (amount < 0) {
            throw new Error(
              `"${snap.get("name")}" has only ${previous}; cannot subtract ${-delta}.`,
            );
          }
          tx.update(ref, { amount, lastEdited: FieldValue.serverTimestamp() });
          return { id, name: snap.get("name"), previousAmount: previous, amount };
        });
        return json(result);
      } catch (err) {
        return fail((err as Error).message);
      }
    },
  );

  server.registerTool(
    "set_item_photo",
    {
      title: "Set item photo",
      description:
        "Download an image from a public http(s) URL, store it in the app's Firebase Storage (like a photo uploaded in the web app) and make it the item's photo. Max 10 MB.",
      inputSchema: {
        id: idSchema,
        image_url: z.url({ protocol: /^https?$/ }).describe("Public URL of the image."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ id, image_url }) => {
      const ref = items().doc(id);
      const snap = await ref.get();
      if (!snap.exists) return fail(`No item with id "${id}".`);
      let photoUrl: string;
      try {
        photoUrl = await storeImageFromUrl(image_url);
      } catch (err) {
        return fail((err as Error).message);
      }
      await ref.update({ [PHOTO_FIELD]: photoUrl, lastEdited: FieldValue.serverTimestamp() });
      return json({ id, name: snap.get("name"), [PHOTO_FIELD]: photoUrl });
    },
  );

  return server;
}
