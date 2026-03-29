import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function extensionFromFile(file: File): string {
  const fromName = file.name.match(/\.([a-z0-9]+)$/i);
  if (fromName) {
    return fromName[1].toLowerCase();
  }
  const fromMime = MIME_TO_EXT[file.type];
  return fromMime ?? "jpg";
}

export async function uploadItemImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image.");
  }
  if (!storage) {
    throw new Error("Storage is not configured.");
  }
  const ext = extensionFromFile(file);
  const path = `item-images/${crypto.randomUUID()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || undefined,
  });
  return getDownloadURL(storageRef);
}
