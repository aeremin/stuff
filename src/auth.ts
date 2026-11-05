import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db, INVENTORY_COLLECTION } from "./firebase";

export type Session =
  /** Firebase is still restoring the session, or checking access. */
  | { state: "loading" }
  | { state: "signedOut" }
  /** Signed in, but the security rules do not let this account read items. */
  | { state: "denied"; user: User }
  | { state: "signedIn"; user: User };

/** Left behind by the old Google Identity Services sign-in. */
const LEGACY_STORAGE_KEY = "googleUser";

/**
 * Asks Firestore whether the signed-in user may read the inventory, so the
 * allowlist stays in the security rules only. Anything other than a clear
 * "permission denied" (being offline, for example) counts as allowed: the
 * pages then show their own errors.
 */
async function hasInventoryAccess(): Promise<boolean> {
  try {
    await getDocs(query(collection(db, INVENTORY_COLLECTION), limit(1)));
    return true;
  } catch (err) {
    return !(err instanceof FirebaseError && err.code === "permission-denied");
  }
}

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

    // Auth changes can overlap with a slow access check; only the latest
    // one may set the session.
    let latest = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const check = ++latest;
      if (!user) {
        setSession({ state: "signedOut" });
        return;
      }
      setSession({ state: "loading" });
      const allowed = await hasInventoryAccess();
      if (check === latest) {
        setSession(allowed ? { state: "signedIn", user } : { state: "denied", user });
      }
    });
    return () => {
      latest = -1;
      unsubscribe();
    };
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
