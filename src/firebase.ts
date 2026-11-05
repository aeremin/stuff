import { type FirebaseOptions, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Client-side config; not secret. Access is enforced by the security rules.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDMhMou7EPvdXE0YZlJeHv1nn6-M1uExkg",
  authDomain: "stuff-11062.firebaseapp.com",
  projectId: "stuff-11062",
  storageBucket: "stuff-11062.firebasestorage.app",
  messagingSenderId: "281115569091",
  appId: "1:281115569091:web:0b7e78724dcb6a6b312b76",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const INVENTORY_COLLECTION = "items";
