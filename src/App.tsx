import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { auth } from "./firebase.ts";
import { AddItemPage } from "./pages/AddItemPage.tsx";
import { ConnectPage } from "./pages/ConnectPage.tsx";
import { EditItemPage } from "./pages/EditItemPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { ItemPage } from "./pages/ItemPage.tsx";
import { PurefilPage } from "./pages/PurefilPage.tsx";
import "./style.css";

interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

function toGoogleUser(user: User | null): GoogleUser | null {
  if (!user?.email) return null;
  return {
    name: user.displayName || user.email,
    email: user.email,
    picture: user.photoURL ?? undefined,
  };
}

function LoginView() {
  const clientId =
    "281115569091-qnmc2t7vfrl83lmg9ou2i94bf501ku5t.apps.googleusercontent.com";
  const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [googleLoaded, setGoogleLoaded] = useState(
    () => Boolean(window.google?.accounts?.id),
  );

  // The Google Identity script loads async and can arrive after this view
  // has mounted; wait for it instead of never rendering the button.
  useEffect(() => {
    if (googleLoaded) return;
    const script = document.getElementById("google-identity");
    const onLoad = () => setGoogleLoaded(Boolean(window.google?.accounts?.id));
    script?.addEventListener("load", onLoad);
    // It may have finished loading between the first render and now.
    onLoad();
    return () => script?.removeEventListener("load", onLoad);
  }, [googleLoaded]);

  useEffect(() => {
    if (!buttonElement || !googleLoaded || !window.google?.accounts?.id) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: unknown) => {
        const idToken = (response as { credential?: string }).credential;
        if (!idToken || !auth) return;
        setError(null);
        try {
          // The app switches to the signed-in view through onAuthStateChanged.
          await signInWithCredential(
            auth,
            GoogleAuthProvider.credential(idToken),
          );
        } catch (err) {
          console.error("failed to sign in", err);
          setError(
            err instanceof Error ? err.message : "Failed to sign in.",
          );
        }
      },
    });

    window.google.accounts.id.renderButton(buttonElement, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      width: 260,
    });
  }, [buttonElement, clientId, googleLoaded]);

  return (
    <div className="app app--unauthorized">
      <div ref={setButtonElement} className="google-button-container" />
      {error && <p className="home__status home__status--error">{error}</p>}
    </div>
  );
}

interface AppHeaderProps {
  user: GoogleUser;
  onSignOut: () => void;
}

function AppHeader({ user, onSignOut }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="user-info">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="user-avatar"
          />
        ) : (
          <div className="user-avatar user-avatar--fallback">
            {user.name
              .split(" ")
              .map((part) => part.charAt(0))
              .join("")
              .toUpperCase()}
          </div>
        )}
        <div className="user-text">
          <span className="user-name">{user.name}</span>
          <span className="user-email">{user.email}</span>
        </div>
      </div>
      <button
        type="button"
        className="logout-button"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </header>
  );
}

// Earlier versions kept the signed-in user here, separately from the
// Firebase session; it is no longer read.
const LEGACY_STORAGE_KEY = "googleUser";

export function App() {
  // undefined until Firebase Auth has restored the persisted session.
  const [user, setUser] = useState<GoogleUser | null | undefined>(
    auth ? undefined : null,
  );

  useEffect(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (!auth) return;
    return onAuthStateChanged(auth, (firebaseUser) =>
      setUser(toGoogleUser(firebaseUser)),
    );
  }, []);

  const handleSignOut = async () => {
    if (user?.email && window.google?.accounts?.id) {
      window.google.accounts.id.revoke(user.email, () => {
        // no-op
      });
    }

    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      console.error("failed to sign out", error);
    }
  };

  if (user === undefined) {
    return <div className="app app--unauthorized" />;
  }

  if (!user) {
    return <LoginView />;
  }

  const currentUser = user;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="app app--authorized">
            <AppHeader user={currentUser} onSignOut={handleSignOut} />

            <main className="app-main">
              <HomePage />
            </main>
          </div>
        }
      />
      <Route
        path="/add"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} onSignOut={handleSignOut} />
            <AddItemPage />
          </div>
        }
      />
      <Route
        path="/connect"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} onSignOut={handleSignOut} />
            <ConnectPage />
          </div>
        }
      />
      <Route
        path="/purefil"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} onSignOut={handleSignOut} />
            <PurefilPage />
          </div>
        }
      />
      <Route
        path="/item/:id"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} onSignOut={handleSignOut} />
            <ItemPage />
          </div>
        }
      />
      <Route
        path="/item/:id/edit"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} onSignOut={handleSignOut} />
            <EditItemPage />
          </div>
        }
      />
    </Routes>
  );
}
