import type { User } from "firebase/auth";
import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { signIn, signOut, useSession } from "./auth.ts";
import { AddItemPage } from "./pages/AddItemPage.tsx";
import { ConnectPage } from "./pages/ConnectPage.tsx";
import { EditItemPage } from "./pages/EditItemPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { ItemPage } from "./pages/ItemPage.tsx";
import { PurefilPage } from "./pages/PurefilPage.tsx";
import "./style.css";

function LoginView() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app app--unauthorized">
      <button
        type="button"
        className="sign-in-button"
        onClick={handleSignIn}
        disabled={busy}
      >
        {busy ? "Signing in…" : "Sign in with Google"}
      </button>
      {error && <p className="sign-in-error">{error}</p>}
    </div>
  );
}

function AppHeader({ user }: { user: User }) {
  const name = user.displayName || user.email || "";
  return (
    <header className="app-header">
      <div className="user-info">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={name}
            className="user-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="user-avatar user-avatar--fallback">
            {name
              .split(" ")
              .map((part) => part.charAt(0))
              .join("")
              .toUpperCase()}
          </div>
        )}
        <div className="user-text">
          <span className="user-name">{name}</span>
          {user.email && user.email !== name && (
            <span className="user-email">{user.email}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="logout-button"
        onClick={() => void signOut()}
      >
        Sign out
      </button>
    </header>
  );
}

export function App() {
  const session = useSession();

  if (session.state === "loading") {
    return null;
  }
  if (session.state === "signedOut") {
    return <LoginView />;
  }

  const currentUser = session.user;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="app app--authorized">
            <AppHeader user={currentUser} />

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
            <AppHeader user={currentUser} />
            <AddItemPage />
          </div>
        }
      />
      <Route
        path="/connect"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} />
            <ConnectPage />
          </div>
        }
      />
      <Route
        path="/purefil"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} />
            <PurefilPage />
          </div>
        }
      />
      <Route
        path="/item/:id"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} />
            <ItemPage />
          </div>
        }
      />
      <Route
        path="/item/:id/edit"
        element={
          <div className="app app--authorized app--with-header">
            <AppHeader user={currentUser} />
            <EditItemPage />
          </div>
        }
      />
    </Routes>
  );
}
