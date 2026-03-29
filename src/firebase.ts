import {
  type FirebaseApp,
  type FirebaseOptions,
  initializeApp,
} from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDMhMou7EPvdXE0YZlJeHv1nn6-M1uExkg",
  authDomain: "stuff-11062.firebaseapp.com",
  projectId: "stuff-11062",
  storageBucket: "stuff-11062.firebasestorage.app",
  messagingSenderId: "281115569091",
  appId: "1:281115569091:web:0b7e78724dcb6a6b312b76",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore;
let storage: FirebaseStorage | null = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    // Firebase not configured
    console.error("Firebase not configured", error);
  }
}

const INVENTORY_COLLECTION = "items";

export { auth, db, INVENTORY_COLLECTION, storage };

