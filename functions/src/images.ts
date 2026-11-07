/**
 * Reading and writing item images in Firebase Storage, shared by the MCP
 * tools (set_item_photo) and the thumbnail trigger.
 */
import { randomUUID } from "node:crypto";
import { bucket } from "./firebase.js";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/heic": "heic",
};

export function imageExtension(contentType: string): string {
  return IMAGE_EXTENSIONS[contentType] ?? "jpg";
}

export interface DownloadedImage {
  bytes: Buffer;
  contentType: string;
}

/** Downloads an image from a public http(s) URL, up to MAX_IMAGE_BYTES. */
export async function fetchImage(source: string): Promise<DownloadedImage> {
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
  if (declared > MAX_IMAGE_BYTES) throw new Error("The image is larger than 10 MB.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("The image is larger than 10 MB.");
  return { bytes, contentType };
}

/**
 * The Storage path behind a Firebase download URL for this project's bucket
 * (https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media&token=…),
 * or undefined for any other URL.
 */
function ownStoragePath(source: string): string | undefined {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return undefined;
  }
  if (url.hostname !== "firebasestorage.googleapis.com") return undefined;
  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match || match[1] !== bucket().name) return undefined;
  return decodeURIComponent(match[2]!);
}

/**
 * Reads an image from this project's Storage (photos uploaded by the web app
 * or set_item_photo) or, for any other URL, downloads it.
 */
export async function readImage(source: string): Promise<DownloadedImage> {
  const path = ownStoragePath(source);
  if (path === undefined) return fetchImage(source);
  const file = bucket().file(path);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size ?? 0) > MAX_IMAGE_BYTES) {
    throw new Error("The image is larger than 10 MB.");
  }
  const [bytes] = await file.download();
  return { bytes, contentType: metadata.contentType ?? "" };
}

export interface StoredImage {
  path: string;
  url: string;
}

/**
 * Saves an image to Storage and returns its path and a download URL of the
 * same form the web app's uploads get (src/storageUpload.ts).
 */
export async function saveImage(
  path: string,
  bytes: Buffer,
  contentType: string,
  cacheControl?: string,
): Promise<StoredImage> {
  const token = randomUUID();
  const file = bucket().file(path);
  await file.save(bytes, {
    contentType,
    metadata: {
      ...(cacheControl ? { cacheControl } : {}),
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { path, url };
}

/** Deletes a file from Storage; a file that is already gone is fine. */
export async function deleteImage(path: string): Promise<void> {
  await bucket().file(path).delete({ ignoreNotFound: true });
}
