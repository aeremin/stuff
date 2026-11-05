import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "./firebase";

export type Session =
  /** Firebase is still restoring the session. */
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "signedIn"; user: User };

/** Left behind by the old Google Identity Services sign-in. */
const LEGACY_STORAGE_KEY = "googleUser";

/** The current user, following Firebase Auth as the only source of truth. */
export function useSession(): Session {
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // storage unavailable; nothing to clean up
    }

    if (!auth) {
      setSession({ state: "signedOut" });
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setSession(user ? { state: "signedIn", user } : { state: "signedOut" });
    });
  }, []);

  return session;
}

const CANCELLED_SIGN_IN = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

/**
 * Opens Google sign-in in a popup. A popup rather than a redirect, because
 * the auth domain (firebaseapp.com) differs from the hosting domain
 * (web.app), which breaks redirect sign-in in browsers that block
 * third-party storage. Resolves quietly if the user closes the popup.
 */
export async function signIn(): Promise<void> {
  if (!auth) throw new Error("Firebase Auth is not configured.");
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    if (err instanceof FirebaseError && CANCELLED_SIGN_IN.has(err.code)) return;
    if (err instanceof FirebaseError && err.code === "auth/popup-blocked") {
      throw new Error("The sign-in window was blocked. Allow popups for this site and try again.");
    }
    throw err;
  }
}

export async function signOut(): Promise<void> {
  if (auth) await firebaseSignOut(auth);
}
