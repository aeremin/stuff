# Agents

## Cursor Cloud specific instructions

### Overview

"Stuff" is a single-page React + TypeScript inventory management app built with Vite. All backend services (Firebase Auth, Firestore, Storage, Algolia) are remote SaaS — there are no local servers, databases, or containers to run.

### Commands

See `package.json` scripts and `README.md` for details. Key commands:

- `npm run dev` — start Vite dev server (port 5173)
- `npm run build` — TypeScript check + Vite production build
- `npx tsc --noEmit` — type-check only (this project has no ESLint or separate linter)

### Important notes

- **No test framework**: There are no automated tests in this project. Type-checking via `tsc --noEmit` is the only static analysis available.
- **Authentication**: Google Sign-In requires valid OAuth origins. In the Cloud Agent VM the Google OAuth flow will return an `origin_mismatch` error because `localhost:5173` is not an authorized origin for the Firebase project. The app still renders and routes work correctly without being signed in.
- **Firestore rules**: Write access is restricted to two specific email addresses. Full CRUD testing requires one of those accounts or modifying `firestore.rules`.
- **No `.env` files**: Firebase config and Algolia keys are hardcoded in source (not secret — they are client-side keys).
