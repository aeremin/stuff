# Stuff

A small web app for tracking personal belongings: screws, filament, tools, electronic parts, Lego sets and so on. It is a single-page **React + TypeScript** app built with **Vite**. All backend services are hosted (Firebase and Algolia), so there is no server to run locally. A remote [MCP server](#mcp-server) on the same Firebase project lets AI assistants search and edit the inventory.

Live at <https://stuff-11062.web.app>.

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`. Everything is behind Google sign-in; until you sign in you only see the sign-in button.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc`) and build into `dist/` |
| `npm run preview` | Serve the production build locally |

There are no automated tests or linter; `npx tsc --noEmit` is the only static check.

## Pages

| Route | Page |
| --- | --- |
| `/` | Search (Algolia) and the five most recently viewed items |
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
- **Firestore and Storage:** [`firestore.rules`](firestore.rules) and [`storage.rules`](storage.rules) allow reads and writes only for two hardcoded email addresses.
- **Search:** the home page queries the Algolia index **`global`** with a search-only key. Keeping that index in sync with Firestore happens outside this repository. The index is readable by anyone who has the key, which ships in the client bundle, regardless of the Firestore rules.

Firebase config and Algolia keys are hardcoded in [`src/firebase.ts`](src/firebase.ts) and [`src/algolia.ts`](src/algolia.ts). They are client-side keys, not secrets; there are no `.env` files.

## Deployment

GitHub Actions deploys to Firebase:

- every push to `master` deploys Cloud Functions (the [MCP server](#mcp-server)) and then the live site;
- every pull request from this repository gets a Hosting preview channel (functions are not deployed from pull requests).

Both use the service account in the `FIREBASE_SERVICE_ACCOUNT_STUFF_11062` secret. Deploying functions needs more than the Hosting roles the Firebase CLI grants it, typically Cloud Functions Admin, Cloud Run Admin, Service Account User, Artifact Registry Administrator and Service Usage Consumer; a failed run names any permission that is still missing.

Rule and index changes have to be deployed by hand:

```bash
firebase deploy --only firestore,storage
```

## MCP server

`https://stuff-11062.web.app/mcp` is a remote [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, stateless, JSON responses). Add it to any MCP client that supports remote servers with OAuth, for example as a custom connector in Claude or with:

```bash
claude mcp add --transport http stuff https://stuff-11062.web.app/mcp
```

The client opens a browser window on the app's `/connect` page; approve it while signed in with one of the allowed Google accounts.

### Tools

| Tool | What it does |
| --- | --- |
| `describe_schema` | Item kinds and fields, generated from `src/schema.ts` |
| `search_items` | Full-text search through the Algolia index, like the home page |
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
- Firebase Hosting rewrites `/mcp`, `/authorize`, `/token`, `/register`, `/revoke`, `/oauth/**` and `/.well-known/**` to that function (see [`firebase.json`](firebase.json)), so the server shares the app's origin.
- Signing in reuses the app itself. `/authorize` redirects to `/connect`, where the already signed-in user approves; the page sends their Firebase ID token to the function, which checks it against the same two email addresses as the security rules (`ALLOWED_EMAILS` in [`functions/src/config.ts`](functions/src/config.ts); keep both lists in sync). The Admin SDK bypasses the rules, so this check is what protects the data. Access tokens are re-checked against the list on every request.
- OAuth state is kept in Firestore: `mcpClients`, `mcpAuthRequests`, `mcpAuthCodes` and `mcpTokens`. Codes and tokens are random strings stored only as SHA-256 hashes; access tokens last an hour, refresh tokens 90 days. TTL policies in [`firestore.indexes.json`](firestore.indexes.json) remove expired records.
- The function needs the Blaze plan, like any Cloud Function.

Build and type-check it with:

```bash
npm --prefix functions install
npm --prefix functions run build
```

The function compiles `src/schema.ts` together with its own code, so the web app and the MCP tools always share one schema.
