import type { User } from "firebase/auth";
import { lazy, Suspense, useState } from "react";
import { Link, Outlet, Route, Routes } from "react-router-dom";
import { signIn, signOut, useSession } from "./auth.ts";
import { homeLocation } from "./components/BackToHomeLink.tsx";
import { AddItemPage } from "./pages/AddItemPage.tsx";
import { ConnectPage } from "./pages/ConnectPage.tsx";
import { EditItemPage } from "./pages/EditItemPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { ItemPage } from "./pages/ItemPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import "./style.css";

// Loaded on demand: it pulls in the chart library and the Pantone table.
const PurefilPage = lazy(() =>
  import("./pages/PurefilPage.tsx").then((m) => ({ default: m.PurefilPage })),
);

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
      <h1 className="sign-in__title">Stuff</h1>
      <p className="sign-in__subtitle">Sign in to see your inventory.</p>
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
  // Shown on hover, since the bar has room only for the name.
  const fullName =
    user.email && user.email !== name ? `${name} (${user.email})` : name;
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to={homeLocation()} className="app-header__brand">
          Stuff
        </Link>
        <div className="user-info" title={fullName}>
          <span className="user-name">{name}</span>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="user-avatar"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="user-avatar user-avatar--fallback" aria-hidden="true">
              {name
                .split(" ")
                .map((part) => part.charAt(0))
                .join("")
                .toUpperCase()}
            </div>
          )}
          <button
            type="button"
            className="logout-button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

/** The signed-in page frame: header on top, the current route below. */
function AppLayout({ user }: { user: User }) {
  return (
    <div className="app app--authorized">
      <AppHeader user={user} />
      <main className="app-main">
        <Suspense fallback={<p className="home__status">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
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

  return (
    <Routes>
      <Route element={<AppLayout user={session.user} />}>
        <Route index element={<HomePage />} />
        <Route path="add" element={<AddItemPage />} />
        <Route path="connect" element={<ConnectPage />} />
        <Route path="purefil" element={<PurefilPage />} />
        <Route path="item/:id" element={<ItemPage />} />
        <Route path="item/:id/edit" element={<EditItemPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
