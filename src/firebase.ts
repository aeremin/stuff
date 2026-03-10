import { type FirebaseApp, type FirebaseOptions, initializeApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { type Firestore, getFirestore } from 'firebase/firestore'

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDMhMou7EPvdXE0YZlJeHv1nn6-M1uExkg",
  authDomain: "stuff-11062.firebaseapp.com",
  projectId: "stuff-11062",
  storageBucket: "stuff-11062.firebasestorage.app",
  messagingSenderId: "281115569091",
  appId: "1:281115569091:web:0b7e78724dcb6a6b312b76",
};

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app) as Firestore;
  } catch (error) {
    // Firebase not configured
    console.error('Firebase not configured', error)
  }
}

export { auth, db }
