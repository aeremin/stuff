import { type FirebaseApp, type FirebaseOptions, initializeApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { type Firestore, getFirestore } from 'firebase/firestore'

const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyD8IzGey1unClZ_GXKhfyBR84-UnL_Ezlc',
  authDomain: 'alice-larp.firebaseapp.com',
  projectId: 'alice-larp',
  storageBucket: 'alice-larp.firebasestorage.app',
  messagingSenderId: '815779847222',
  appId: '1:815779847222:web:cd6fb2946ad97c642f0c97',
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app, "inventory") as Firestore;
  } catch (error) {
    // Firebase not configured
    console.error('Firebase not configured', error)
  }
}

export { auth, db }
