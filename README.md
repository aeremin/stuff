# Stuff

A small web app for tracking personal belongings: screws, filament, tools, electronic parts, Lego sets and so on. It is a single-page **React + TypeScript** app built with **Vite**. All backend services are hosted (Firebase and Algolia), so there is no server to run locally. A remote [MCP server](#mcp-server) on the same Firebase project lets AI assistants search and edit the inventory.

Live at <https://stuff.aerem.in>, a custom domain on Firebase Hosting. The same site is also served at <https://stuff-11062.web.app>, the address the [MCP server](#mcp-server) uses.

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`. Everything is behind Google sign-in; until you sign in you only see the sign-in button. The dev server proxies `/api` (search) to the deployed function at `https://stuff-11062.web.app`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc`) and build into `dist/` |
| `npm run preview` | Serve the production build locally |

There are no automated tests or linter; `npx tsc --noEmit` is the only static check.

## Pages

| Route | Page |
| --- | --- |
| `/` | Search (Algolia, through the Cloud Function) and the five most recently viewed items |
| `/add` | Add a new item |
| `/item/:id` | Item details; on phones with Web NFC (Chrome on Android) it can write the page URL to an NFC tag |
| `/item/:id/edit` | Edit an item |
| `/purefil` | Bar chart of Purefil filament stock by colour (not linked from the UI) |
| `/connect` | Approve an MCP client (opened by the MCP server's sign-in flow) |

Opening an item or its edit page updates its `lastViewed` timestamp, which drives the "Last viewed" list.

## Data model

Items live in the Firestore collection **`items`** of the Firebase project **`stuff-11062`**. Each item has `name`, `kind`, a set of other fields, and `lastEdited` / `lastViewed` timestamps.

The fields are defined in [`src/schema.ts`](src/schema.ts): their type (number, string, markdown, url, image, select) and which item kinds they apply to. The add/edit form and the item page are generated from that list, so a new field or kind only needs to be added there. Fields stored on an item that are not in the schema are still shown on its page, under their raw key.

Photos are uploaded to Firebase Storage under `item-images/` and stored on the item as a download URL.

## Services and access

- **Auth:** Firebase Auth with the Google provider, signed in through a popup. The app follows Firebase Auth's own session. Any Google account can sign in; for accounts the security rules do not allow, every page just fails to load its data.

  Sign-in only works on domains listed under **Authorized domains** in the Firebase console (Authentication → Settings). Firebase adds `localhost`, `stuff-11062.firebaseapp.com` and `stuff-11062.web.app` on its own; the custom domain `stuff.aerem.in`, and any other domain the app is served from, has to be added by hand, or sign-in fails with `auth/unauthorized-domain`.
- **Who has access:** Firebase Auth users with the custom claim `admin: true` (and a verified email). [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules) and the Cloud Function ([`functions/src/access.ts`](functions/src/access.ts)) all check that claim, so there is no list of emails to keep in sync. The claim is set by hand with the Admin SDK, e.g. `getAuth().setCustomUserClaims(uid, { admin: true })`; the user then signs out and back in, since ID tokens only pick up new claims when they are refreshed. Removing the claim cuts off the web app within an hour (when the ID token expires) and MCP clients within a minute.
- **Search:** the Algolia index **`global`** holds a copy of every item, and anyone with a key for it can read it all, whatever the Firestore rules say. So the browser never gets a key. The home page sends its query to `POST /api/search` on the Cloud Function ([`functions/src/search.ts`](functions/src/search.ts)) along with the user's Firebase ID token. The function checks the token for the admin claim and then queries Algolia. MCP search uses the same code. The search-only key is the Secret Manager secret **`ALGOLIA_SEARCH_KEY`**. Keeping the index in sync with Firestore happens outside this repository, with its own key.

The Firebase config is hardcoded in [`src/firebase.ts`](src/firebase.ts); it's a client-side key, not a secret. There are no `.env` files.

## Deployment

GitHub Actions deploys to Firebase:

- every push to `master` deploys the Firestore and Storage security rules and the Firestore indexes (with the TTL policies), then Cloud Functions (the [MCP server](#mcp-server)), then the live site;
- every pull request from this repository compiles the rules and checks the indexes file without deploying them (`--dry-run`), and gets a Hosting preview channel (functions, rules and indexes are not deployed from pull requests). Preview domains are not authorized for sign-in, so a preview only gets as far as the sign-in screen unless its domain is added to the authorized domains.

So [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules) and [`firestore.indexes.json`](firestore.indexes.json) on `master` are what's deployed; don't change rules or indexes in the Firebase console, as the next deploy overwrites them. The one exception is deletion: an index or field override that exists in the project but not in the file is left in place (the deploy log reports it). To remove one, delete it in the console, or deploy once by hand with `--force`.

Both workflows use the service account in the `FIREBASE_SERVICE_ACCOUNT_STUFF_11062` secret. Deploying needs more than the Hosting roles the Firebase CLI grants it: for functions, typically Cloud Functions Admin, Cloud Run Admin, Service Account User, Artifact Registry Administrator, Service Usage Consumer and Secret Manager Admin (the deploy grants the function access to its secret); for rules and indexes, Firebase Rules Admin and Cloud Datastore Index Admin. A failed run names any permission that is still missing.

The function's secret is set by hand, once and again whenever the key is rotated. A new value takes effect on the next functions deploy:

```bash
firebase functions:secrets:set ALGOLIA_SEARCH_KEY --project stuff-11062
```

Use an Algolia key with only the `search` ACL, restricted to the `global` index.

Rules and indexes can still be deployed by hand, for example to try a change before merging it:

```bash
firebase deploy --only firestore,storage --project stuff-11062
```

## MCP server

`https://stuff-11062.web.app/mcp` is a remote [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, stateless, JSON responses). Add it to any MCP client that supports remote servers with OAuth, for example as a custom connector in Claude or with:

```bash
claude mcp add --transport http stuff https://stuff-11062.web.app/mcp
```

The client opens a browser window on the app's `/connect` page; approve it while signed in with a Google account that has access.

### Tools

| Tool | What it does |
| --- | --- |
| `describe_schema` | Item kinds and fields, generated from `src/schema.ts` |
| `search_items` | Full-text search through the Algolia index, the same search as the home page |
| `list_items` | Browse items, optionally of one kind, by last edited, last viewed or name |
| `get_item` | All fields of one item |
| `create_item` | Add an item; arguments are the schema fields |
| `update_item` | Change some fields of an item; `null` clears a field |
| `adjust_amount` | Add to or subtract from `amount` atomically |
| `set_item_photo` | Download an image URL into Storage (`item-images/`) and set it as the photo |

Items written through MCP are stored the same way the web form stores them: blank fields as `""` or `0`, fields that do not apply to the item's kind cleared, and `lastEdited` set. Reads do not touch `lastViewed`. There is no delete tool, as the web app has none.

### How it is hosted

Everything runs in the `stuff-11062` project; the code is in [`functions/`](functions):

- One 2nd gen Cloud Function, **`mcp`** (`europe-west6`, next to Firestore), is an Express app serving the MCP endpoint and an OAuth 2.1 authorization server built on the MCP SDK's auth router: dynamic client registration, PKCE, refresh token rotation and revocation.
- Firebase Hosting rewrites `/mcp`, `/authorize`, `/token`, `/register`, `/revoke`, `/oauth/**`, `/api/**` (the web app's search) and `/.well-known/**` to that function (see [`firebase.json`](firebase.json)), so the server shares the app's origin.
- Signing in reuses the app itself. `/authorize` redirects to `/connect`, where the already signed-in user approves; the page sends their Firebase ID token to the function, which checks it for the same admin claim as the security rules ([`functions/src/access.ts`](functions/src/access.ts)). The Admin SDK bypasses the rules, so this check is what protects the data. On every request, and on every refresh, the token's user is looked up again in Firebase Auth (cached for a minute per instance): a disabled account, or one without the claim, is turned away.
- OAuth state is kept in Firestore: `mcpClients`, `mcpAuthRequests`, `mcpAuthCodes` and `mcpTokens`. Codes and tokens are random strings stored only as SHA-256 hashes; access tokens last an hour, refresh tokens 90 days. TTL policies in [`firestore.indexes.json`](firestore.indexes.json) remove expired records.
- The function needs the Blaze plan, like any Cloud Function.

Build and type-check it with:

```bash
npm --prefix functions install
npm --prefix functions run build
```

The function compiles `src/schema.ts` together with its own code, so the web app and the MCP tools always share one schema.
