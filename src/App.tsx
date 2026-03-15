import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
} from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { auth } from "./firebase.ts";
import { AddItemPage } from "./pages/AddItemPage.tsx";
import { EditItemPage } from "./pages/EditItemPage.tsx";
import { ItemPage } from "./pages/ItemPage.tsx";
import "./style.css";

interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

const STORAGE_KEY = "googleUser";

interface GoogleJwtPayload {
  name?: string;
  email?: string;
  picture?: string;
}

function parseGoogleUserFromCredential(
  credential: string | undefined,
): GoogleUser | null {
  if (!credential) {
    return null;
  }

  try {
    const base64Payload = credential.split(".")[1];
    if (!base64Payload) {
      return null;
    }

    const normalized = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const json = decodeURIComponent(
      Array.from(decoded)
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );

    const payload = JSON.parse(json) as GoogleJwtPayload;

    if (!payload.email || !payload.name) {
      return null;
    }

    return {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

interface LoginViewProps {
  onSignedIn: (user: GoogleUser) => void;
}

function LoginView({ onSignedIn }: LoginViewProps) {
  const clientId =
    "281115569091-qnmc2t7vfrl83lmg9ou2i94bf501ku5t.apps.googleusercontent.com";
  const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(
    null,
  );

  useEffect(() => {
    if (!buttonElement || !window.google?.accounts?.id) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: unknown) => {
        const idToken = (response as { credential?: string }).credential;
        const user = parseGoogleUserFromCredential(idToken);

        if (user && idToken) {
          try {
            if (auth) {
              const credential = GoogleAuthProvider.credential(idToken);
              await signInWithCredential(auth, credential);
            }
          } catch (error) {
            console.error("failed to sign in", error);
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
          onSignedIn(user);
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
  }, [buttonElement, clientId, onSignedIn]);

  return (
    <div className="app app--unauthorized">
      <div ref={setButtonElement} className="google-button-container" />
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return null;
      }
      return JSON.parse(saved) as GoogleUser;
    } catch {
      return null;
    }
  });

  const isAuthorized = useMemo(() => Boolean(user?.email), [user]);

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
    } catch {
      // ignore if Firebase Auth not used
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  if (!isAuthorized) {
    return <LoginView onSignedIn={setUser} />;
  }

  const currentUser = user!;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="app app--authorized">
            <header className="app-header">
              <div className="user-info">
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar user-avatar--fallback">
                    {currentUser.name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="user-text">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-email">{currentUser.email}</span>
                </div>
              </div>
              <button
                type="button"
                className="logout-button"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </header>

            <main className="app-main">
              <p>
                <Link to="/add">Add new item</Link>
              </p>
            </main>
          </div>
        }
      />
      <Route
        path="/add"
        element={
          <div className="app app--authorized app--with-header">
            <header className="app-header">
              <div className="user-info">
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar user-avatar--fallback">
                    {currentUser.name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="user-text">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-email">{currentUser.email}</span>
                </div>
              </div>
              <button
                type="button"
                className="logout-button"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </header>
            <AddItemPage />
          </div>
        }
      />
      <Route
        path="/item/:id"
        element={
          <div className="app app--authorized app--with-header">
            <header className="app-header">
              <div className="user-info">
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar user-avatar--fallback">
                    {currentUser.name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="user-text">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-email">{currentUser.email}</span>
                </div>
              </div>
              <button
                type="button"
                className="logout-button"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </header>
            <ItemPage />
          </div>
        }
      />
      <Route
        path="/item/:id/edit"
        element={
          <div className="app app--authorized app--with-header">
            <header className="app-header">
              <div className="user-info">
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar user-avatar--fallback">
                    {currentUser.name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="user-text">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-email">{currentUser.email}</span>
                </div>
              </div>
              <button
                type="button"
                className="logout-button"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </header>
            <EditItemPage />
          </div>
        }
      />
    </Routes>
  );
}
