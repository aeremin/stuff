/**
 * Remote MCP server for the Stuff inventory.
 *
 * One HTTPS Cloud Function serves both the MCP endpoint (POST /mcp, Streamable
 * HTTP, stateless) and the OAuth 2.1 authorization server MCP clients use to
 * get a token. Firebase Hosting rewrites those paths to this function (see
 * firebase.json), so everything lives under https://stuff-11062.web.app.
 * It also serves the web app's search (POST /api/search, see search.ts).
 */
import cors from "cors";
import express from "express";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { BASE_URL, MCP_URL } from "./config.js";
import { db } from "./firebase.js";
import { FirestoreOAuthProvider } from "./oauth.js";
import { algoliaSearchKey, searchRouter } from "./search.js";
import { createMcpServer } from "./tools.js";

export { itemThumbnails } from "./thumbnails.js";

const provider = new FirestoreOAuthProvider(db);

const app = express();
app.disable("x-powered-by");

// Per-instance in-memory rate limits mean little on autoscaled functions, and
// express-rate-limit objects to the proxy headers Hosting adds.
const noRateLimit = { rateLimit: false } as const;
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: BASE_URL,
    resourceServerUrl: MCP_URL,
    resourceName: "Stuff inventory",
    serviceDocumentationUrl: new URL(
      "https://github.com/aeremin/stuff#mcp-server",
    ),
    authorizationOptions: noRateLimit,
    tokenOptions: noRateLimit,
    revocationOptions: noRateLimit,
    clientRegistrationOptions: { ...noRateLimit, clientSecretExpirySeconds: 0 },
  }),
);

app.use("/oauth", provider.consentRouter());

const requireToken = requireBearerAuth({
  verifier: provider,
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(MCP_URL),
  expectedResource: MCP_URL,
});

app.use(
  "/mcp",
  cors({ exposedHeaders: ["Mcp-Session-Id", "WWW-Authenticate"] }),
);

app.post("/mcp", requireToken, async (req, res) => {
  // Stateless: a fresh server and transport per request, plain JSON
  // responses (no SSE), which also passes cleanly through Hosting.
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error("MCP request failed", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// No sessions, so no server-initiated stream (GET) or session end (DELETE).
app.all("/mcp", requireToken, (_req, res) => {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
});

// Same origin as the web app through Hosting, so no CORS.
app.use("/api", searchRouter());

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

export const mcp = onRequest(
  {
    region: "europe-west6",
    invoker: "public",
    maxInstances: 5,
    timeoutSeconds: 60,
    secrets: [algoliaSearchKey],
  },
  app,
);
