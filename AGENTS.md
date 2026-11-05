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
- **Authentication**: Sign-in is Firebase Auth's Google popup (`signInWithPopup`, see `src/auth.ts`), so it needs a real Google account on one of the allowed emails, and the page's domain must be an authorized domain in Firebase Auth. In the Cloud Agent VM you can only check the app up to the sign-in screen.
- **Firestore rules**: Write access is restricted to two specific email addresses. Full CRUD testing requires one of those accounts or modifying `firestore.rules`.
- **No `.env` files**: Firebase config and Algolia keys are hardcoded in source (not secret — they are client-side keys).
