import type { Timestamp } from "firebase/firestore";

export interface InventoryItem {
  id: string;
  name: string;
  lastEdited?: Timestamp;
  lastViewed?: Timestamp;
  [key: string]: unknown;
}