/**
 * A small OAuth 2.1 authorization server for MCP clients, backed by Firestore.
 *
 * The protocol endpoints (/authorize, /token, /register, /revoke and the
 * .well-known metadata) come from the MCP SDK's mcpAuthRouter; this file
 * supplies the storage and the one step the SDK leaves open: authenticating
 * the user. For that, /authorize sends the browser to the web app's /connect
 * page, where the user is already signed in with Google through Firebase Auth.
 * That page posts the user's Firebase ID token back to /oauth/requests/:id/...,
 * which checks it for the same admin claim as the Firestore rules (see
 * access.ts) and issues the authorization code.
 *
 * Codes and tokens are random strings; Firestore only stores their SHA-256.
 */
import { createHash, randomBytes } from "node:crypto";
import express, { type Router } from "express";
import { logger } from "firebase-functions";
import {
  Timestamp,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import type { Response } from "express";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  InvalidGrantError,
  InvalidTargetError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { checkIdToken, userHasAccess } from "./access.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  AUTH_REQUEST_TTL_SECONDS,
  CONSENT_PAGE_URL,
  MCP_URL,
  OAUTH_COLLECTIONS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./config.js";

interface AuthRequestDoc {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scopes: string[];
  expiresAt: Timestamp;
}

interface AuthCodeDoc {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  uid: string;
  email: string;
  expiresAt: Timestamp;
}

interface TokenDoc {
  kind: "access" | "refresh";
  /** Shared by every access/refresh token descended from one approval. */
  grantId: string;
  clientId: string;
  uid: string;
  email: string;
  scopes: string[];
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

function randomSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function expiresIn(seconds: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + seconds * 1000);
}

function isExpired(ts: Timestamp): boolean {
  return ts.toMillis() <= Date.now();
}

function normalizeResource(url: URL): string {
  const copy = new URL(url.href);
  copy.hash = "";
  return copy.href.replace(/\/$/, "");
}

function checkResource(resource: URL | undefined): void {
  if (resource && normalizeResource(resource) !== normalizeResource(MCP_URL)) {
    throw new InvalidTargetError(
      `This server only issues tokens for ${MCP_URL.href}`,
    );
  }
}

class FirestoreClientsStore implements OAuthRegisteredClientsStore {
  constructor(private readonly db: Firestore) {}

  private doc(clientId: string) {
    return this.db.collection(OAUTH_COLLECTIONS.clients).doc(clientId);
  }

  async getClient(
    clientId: string,
  ): Promise<OAuthClientInformationFull | undefined> {
    // Client ids are UUIDs; anything else cannot be a valid document id.
    if (!/^[\w-]{1,128}$/.test(clientId)) return undefined;
    const snap = await this.doc(clientId).get();
    if (!snap.exists) return undefined;
    const { registeredAt: _registeredAt, ...client } = snap.data()!;
    return client as OAuthClientInformationFull;
  }

  async registerClient(
    client: OAuthClientInformationFull,
  ): Promise<OAuthClientInformationFull> {
    await this.doc(client.client_id).set({
      ...client,
      registeredAt: Timestamp.now(),
    });
    logger.info("Registered MCP OAuth client", {
      clientId: client.client_id,
      clientName: client.client_name,
    });
    return client;
  }
}

export class FirestoreOAuthProvider implements OAuthServerProvider {
  private readonly clients: FirestoreClientsStore;

  constructor(private readonly db: Firestore) {
    this.clients = new FirestoreClientsStore(db);
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this.clients;
  }

  private col(name: keyof typeof OAUTH_COLLECTIONS) {
    return this.db.collection(OAUTH_COLLECTIONS[name]);
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    checkResource(params.resource);
    const requestId = randomBytes(24).toString("base64url");
    const request: AuthRequestDoc = {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state ?? null,
      scopes: params.scopes ?? [],
      expiresAt: expiresIn(AUTH_REQUEST_TTL_SECONDS),
    };
    await this.col("requests").doc(requestId).set(request);

    const consent = new URL(CONSENT_PAGE_URL);
    consent.searchParams.set("request", requestId);
    res.redirect(302, consent.href);
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const snap = await this.col("codes").doc(sha256(authorizationCode)).get();
    const code = snap.data() as AuthCodeDoc | undefined;
    if (!code || code.clientId !== client.client_id || isExpired(code.expiresAt)) {
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    return code.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    checkResource(resource);
    const ref = this.col("codes").doc(sha256(authorizationCode));
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const code = snap.data() as AuthCodeDoc | undefined;
      if (!code || code.clientId !== client.client_id || isExpired(code.expiresAt)) {
        throw new InvalidGrantError("Invalid or expired authorization code");
      }
      if (redirectUri !== undefined && redirectUri !== code.redirectUri) {
        throw new InvalidGrantError("redirect_uri does not match the authorization request");
      }
      // Codes are single use.
      tx.delete(ref);
      return this.issueTokens(tx, {
        grantId: randomBytes(16).toString("hex"),
        clientId: client.client_id,
        uid: code.uid,
        email: code.email,
        scopes: code.scopes,
      });
    });
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    _scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    checkResource(resource);
    const ref = this.col("tokens").doc(sha256(refreshToken));
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const token = snap.data() as TokenDoc | undefined;
      if (
        !token ||
        token.kind !== "refresh" ||
        token.clientId !== client.client_id ||
        isExpired(token.expiresAt)
      ) {
        throw new InvalidGrantError("Invalid or expired refresh token");
      }
      if (!(await userHasAccess(token.uid))) {
        tx.delete(ref);
        throw new InvalidGrantError("This account no longer has access");
      }
      // Rotate: the old refresh token stops working once it has been used.
      tx.delete(ref);
      return this.issueTokens(tx, {
        grantId: token.grantId,
        clientId: token.clientId,
        uid: token.uid,
        email: token.email,
        scopes: token.scopes,
      });
    });
  }

  private issueTokens(
    tx: Transaction,
    grant: Pick<TokenDoc, "grantId" | "clientId" | "uid" | "email" | "scopes">,
  ): OAuthTokens {
    const accessToken = randomSecret("stuff_at");
    const refreshToken = randomSecret("stuff_rt");
    const now = Timestamp.now();
    const write = (token: string, kind: TokenDoc["kind"], ttl: number) => {
      const doc: TokenDoc = {
        ...grant,
        kind,
        createdAt: now,
        expiresAt: expiresIn(ttl),
      };
      tx.set(this.col("tokens").doc(sha256(token)), doc);
    };
    write(accessToken, "access", ACCESS_TOKEN_TTL_SECONDS);
    write(refreshToken, "refresh", REFRESH_TOKEN_TTL_SECONDS);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      ...(grant.scopes.length ? { scope: grant.scopes.join(" ") } : {}),
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const snap = await this.col("tokens").doc(sha256(token)).get();
    const doc = snap.data() as TokenDoc | undefined;
    if (!doc || doc.kind !== "access" || isExpired(doc.expiresAt)) {
      throw new InvalidTokenError("Invalid or expired access token");
    }
    if (!(await userHasAccess(doc.uid))) {
      throw new InvalidTokenError("This account no longer has access");
    }
    return {
      token,
      clientId: doc.clientId,
      scopes: doc.scopes,
      expiresAt: Math.floor(doc.expiresAt.toMillis() / 1000),
      resource: MCP_URL,
      extra: { uid: doc.uid, email: doc.email },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const snap = await this.col("tokens").doc(sha256(request.token)).get();
    const doc = snap.data() as TokenDoc | undefined;
    if (!doc || doc.clientId !== client.client_id) return;
    // Revoking either token ends the whole grant.
    const related = await this.col("tokens")
      .where("grantId", "==", doc.grantId)
      .get();
    const batch = this.db.batch();
    related.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(snap.ref);
    await batch.commit();
  }

  // ---- Consent step, called by the web app's /connect page ----

  private async loadRequest(
    requestId: string,
  ): Promise<{ ref: DocumentReference; request: AuthRequestDoc } | null> {
    if (!/^[\w-]{16,64}$/.test(requestId)) return null;
    const ref = this.col("requests").doc(requestId);
    const snap = await ref.get();
    const request = snap.data() as AuthRequestDoc | undefined;
    if (!request || isExpired(request.expiresAt)) return null;
    return { ref, request };
  }

  consentRouter(): Router {
    const router = express.Router();
    router.use(express.json());

    const notFound = (res: Response) =>
      res.status(404).json({
        error:
          "This sign-in request has expired or was already used. Start connecting again from your MCP client.",
      });

    router.get("/requests/:id", async (req, res) => {
      const found = await this.loadRequest(req.params.id);
      if (!found) return void notFound(res);
      const client = await this.clients.getClient(found.request.clientId);
      res.set("Cache-Control", "no-store").json({
        clientName: client?.client_name ?? null,
        clientUri: client?.client_uri ?? null,
        redirectUri: found.request.redirectUri,
      });
    });

    router.post("/requests/:id/decision", async (req, res) => {
      const body = (req.body ?? {}) as { approve?: unknown; idToken?: unknown };
      const found = await this.loadRequest(req.params.id);
      if (!found) return void notFound(res);
      const { ref, request } = found;

      const redirect = new URL(request.redirectUri);
      if (request.state !== null) redirect.searchParams.set("state", request.state);

      if (body.approve !== true) {
        await ref.delete();
        redirect.searchParams.set("error", "access_denied");
        redirect.searchParams.set("error_description", "The user declined access");
        return void res.json({ redirectTo: redirect.href });
      }

      if (typeof body.idToken !== "string") {
        return void res.status(400).json({ error: "Missing idToken" });
      }
      const access = await checkIdToken(body.idToken, "MCP consent");
      if (!access.ok) {
        return void res.status(access.status).json({ error: access.error });
      }
      const { uid, email } = access;

      const code = randomSecret("stuff_ac");
      const codeDoc: AuthCodeDoc = {
        clientId: request.clientId,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        scopes: request.scopes,
        uid,
        email,
        expiresAt: expiresIn(AUTH_CODE_TTL_SECONDS),
      };
      try {
        await this.db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error("already used");
          tx.delete(ref);
          tx.set(this.col("codes").doc(sha256(code)), codeDoc);
        });
      } catch {
        return void notFound(res);
      }
      logger.info("Approved MCP client", { clientId: request.clientId, email });
      redirect.searchParams.set("code", code);
      res.json({ redirectTo: redirect.href });
    });

    return router;
  }
}
