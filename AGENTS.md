# Agents

## Cursor Cloud specific instructions

### Overview

"Stuff" is a single-page React + TypeScript inventory management app built with Vite. All backend services (Firebase Auth, Firestore, Storage, Algolia) are remote SaaS — there are no local servers, databases, or containers to run. The `functions/` directory holds a separate Node package: the remote MCP server (a Cloud Function), described in `README.md`.

### Commands

See `package.json` scripts and `README.md` for details. Key commands:

- `npm run dev` — start Vite dev server (port 5173)
- `npm run build` — TypeScript check + Vite production build
- `npx tsc --noEmit` — type-check only (this project has no ESLint or separate linter)
- `npm --prefix functions run build` — type-check and compile the MCP server function (run `npm --prefix functions install` first)

### Important notes

- **No test framework**: There are no automated tests in this project. Type-checking via `tsc --noEmit` is the only static analysis available.
- **Authentication**: Sign-in is Firebase Auth's Google popup (`signInWithPopup`, see `src/auth.ts`), so it needs a real Google account with access (the `admin` custom claim), and the page's domain must be an authorized domain in Firebase Auth. In the Cloud Agent VM you can only check the app up to the sign-in screen.
- **Firestore rules**: Access is restricted to accounts with the `admin: true` custom claim (`firestore.rules`, `storage.rules`, `functions/src/access.ts`). Full CRUD testing requires one of those accounts or modifying `firestore.rules`.
- **No `.env` files**: the Firebase config is hardcoded in source (not secret — it is a client-side key).
- **Algolia**: the browser has no Algolia key. Search goes through `POST /api/search` on the Cloud Function (`functions/src/search.ts`), which uses the `ALGOLIA_SEARCH_KEY` secret. `npm run dev` proxies `/api` to the deployed function, so search only works with a signed-in account that has access.
