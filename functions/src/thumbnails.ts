/**
 * Thumbnails of item photos.
 *
 * Whenever an item is written, `itemThumbnails` checks its image fields (see
 * src/schema.ts). A field whose value has no thumbnail made from it yet gets
 * one: the image is read from Storage (or downloaded, for an outside URL),
 * shrunk to fit THUMBNAIL_SIZE, saved as WebP under item-thumbnails/ and
 * recorded on the item as `thumbnails.<field id>`. Thumbnails of replaced or
 * removed photos are deleted.
 *
 * That covers photos uploaded in the web app, set through MCP, and older
 * photos: opening an item writes its lastViewed, which fills in a missing
 * thumbnail.
 */
import { randomUUID } from "node:crypto";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/firestore";
import {
  availableFields,
  THUMBNAILS_KEY,
  type Thumbnail,
} from "../../src/schema.js";
import { ITEMS_COLLECTION } from "./config.js";
import { db } from "./firebase.js";
import { deleteImage, readImage, saveImage } from "./images.js";

/**
 * Longest side, in pixels. The item page shows photos at up to 120 CSS
 * pixels, so this stays sharp on screens with up to 3 device pixels per CSS
 * pixel.
 */
const THUMBNAIL_SIZE = 400;
const THUMBNAIL_FOLDER = "item-thumbnails";

const imageFields = availableFields.filter((f) => f.type === "image");

function sourceOf(data: DocumentData | undefined, fieldId: string): string {
  const value = data?.[fieldId];
  return typeof value === "string" ? value.trim() : "";
}

function thumbnailsOf(
  data: DocumentData | undefined,
): Record<string, Thumbnail | undefined> {
  const value = data?.[THUMBNAILS_KEY];
  return value && typeof value === "object" ? value : {};
}

/** Whether the field's thumbnail does not match its current value. */
function needsUpdate(data: DocumentData, fieldId: string): boolean {
  const source = sourceOf(data, fieldId);
  const thumbnail = thumbnailsOf(data)[fieldId];
  return source ? thumbnail?.source !== source : thumbnail !== undefined;
}

/**
 * Makes a thumbnail of the image at `source`. A failure (an unreachable URL,
 * a format sharp cannot read, like HEIC) is recorded rather than thrown, so
 * the item is not retried on every write; the app shows the full photo.
 */
async function makeThumbnail(source: string): Promise<Thumbnail> {
  try {
    const image = await readImage(source);
    // Loaded here so the mcp function, which shares this module graph, does
    // not pay for sharp on a cold start.
    const { default: sharp } = await import("sharp");
    const bytes = await sharp(image.bytes, { failOn: "error" })
      .rotate() // Apply the EXIF orientation of phone photos.
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    // A new name for every thumbnail, so it can be cached forever.
    const stored = await saveImage(
      `${THUMBNAIL_FOLDER}/${randomUUID()}.webp`,
      bytes,
      "image/webp",
      "public, max-age=31536000, immutable",
    );
    return { source, ...stored };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn("Could not make a thumbnail", { source, error });
    return { source, error };
  }
}

export const itemThumbnails = onDocumentWritten(
  {
    document: `${ITEMS_COLLECTION}/{itemId}`,
    region: "europe-west6",
    memory: "512MiB",
    timeoutSeconds: 120,
    maxInstances: 5,
  },
  async (event) => {
    const change = event.data;
    if (!change) return;
    const after = change.after.data();

    if (!after) {
      // The item was deleted.
      const paths = Object.values(thumbnailsOf(change.before.data()))
        .map((t) => t?.path)
        .filter((p): p is string => !!p);
      await Promise.all(paths.map(deleteImage));
      return;
    }

    // Most writes (every view updates lastViewed, and the update below
    // triggers this function again) have nothing to do.
    const pending = imageFields.filter((f) => needsUpdate(after, f.id));
    if (pending.length === 0) return;

    const made = new Map<string, Thumbnail>();
    for (const field of pending) {
      const source = sourceOf(after, field.id);
      if (source) made.set(field.id, await makeThumbnail(source));
    }

    // The item may have changed while the thumbnails were being made, so
    // only record those that still match it.
    const ref = change.after.ref;
    let unused: string[] = [];
    await db.runTransaction(async (tx) => {
      unused = [];
      const latest = (await tx.get(ref)).data();
      const updates: Record<string, unknown> = {};
      for (const field of pending) {
        const fresh = made.get(field.id);
        if (!latest || !needsUpdate(latest, field.id)) {
          if (fresh?.path) unused.push(fresh.path);
          continue;
        }
        const source = sourceOf(latest, field.id);
        const old = thumbnailsOf(latest)[field.id];
        const key = `${THUMBNAILS_KEY}.${field.id}`;
        if (!source) {
          updates[key] = FieldValue.delete();
          if (old?.path) unused.push(old.path);
        } else if (fresh?.source === source) {
          updates[key] = fresh;
          if (old?.path) unused.push(old.path);
        } else if (fresh?.path) {
          // Changed to yet another photo; that write runs this again.
          unused.push(fresh.path);
        }
      }
      if (Object.keys(updates).length > 0) tx.update(ref, updates);
    });
    await Promise.all(unused.map(deleteImage));
  },
);
