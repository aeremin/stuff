import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { auth } from "../firebase";
import "./ItemPage.css";
import "./ConnectPage.css";

// Consent step of the MCP server's OAuth flow (functions/src/oauth.ts):
// /authorize redirects here with ?request=<id>, the signed-in user approves
// or declines, and the server answers with where to send the browser next.

interface PendingRequest {
  clientName: string | null;
  clientUri: string | null;
  redirectUri: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // fall through
  }
  return `Request failed (HTTP ${response.status}).`;
}

export function ConnectPage() {
  const [params] = useSearchParams();
  const requestId = params.get("request") ?? "";
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError("This page is opened by an MCP client while connecting to Stuff.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/oauth/requests/${encodeURIComponent(requestId)}`,
        );
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as PendingRequest;
        if (!cancelled) setRequest(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load the request.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      let idToken: string | undefined;
      if (approve) {
        if (!auth) throw new Error("Firebase Auth is not configured.");
        await auth.authStateReady();
        if (!auth.currentUser) {
          throw new Error(
            "Your Firebase session is missing. Sign out, sign in again and retry.",
          );
        }
        idToken = await auth.currentUser.getIdToken();
      }
      const response = await fetch(
        `/oauth/requests/${encodeURIComponent(requestId)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approve, idToken }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const { redirectTo } = (await response.json()) as { redirectTo: string };
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  let redirectTarget = request?.redirectUri ?? "";
  try {
    const url = new URL(redirectTarget);
    redirectTarget = url.protocol.startsWith("http") ? url.host : url.protocol;
  } catch {
    // show it as is
  }

  return (
    <div className="item-page connect-page">
      <div className="item-page__header">
        <Link to="/" className="item-page__back">
          ← Back to home
        </Link>
      </div>
      <div className="item-page__card">
        <h1 className="item-page__title">Connect an MCP client</h1>
        {loading && <p className="connect-page__text">Loading…</p>}
        {request && (
          <>
            <p className="connect-page__text">
              <strong>{request.clientName || "An unnamed client"}</strong>{" "}
              wants to access your inventory. It will be able to search and
              read items, add new ones and change existing ones.
            </p>
            {request.clientUri && (
              <p className="connect-page__text connect-page__muted">
                Client website: {request.clientUri}
              </p>
            )}
            <p className="connect-page__text connect-page__muted">
              After you decide you will be sent to{" "}
              <code>{redirectTarget}</code>. Only allow access if you started
              this from an app you trust.
            </p>
          </>
        )}
        {error && <p className="connect-page__error">{error}</p>}
        {request && (
          <div className="item-page__actions connect-page__actions">
            <button
              type="button"
              className="item-page__nfc-button"
              disabled={busy}
              onClick={() => decide(true)}
            >
              Allow access
            </button>
            <button
              type="button"
              className="connect-page__deny"
              disabled={busy}
              onClick={() => decide(false)}
            >
              Deny
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
