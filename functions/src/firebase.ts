import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const app = initializeApp();

export const db = getFirestore(app);
// OAuth client metadata has lots of optional fields; drop them instead of
// failing the write.
db.settings({ ignoreUndefinedProperties: true });

export const adminAuth = getAuth(app);
export const bucket = () => getStorage(app).bucket();
