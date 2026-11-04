# Stuff

A small web app for tracking personal belongings: screws, filament, tools, electronic parts, Lego sets and so on. It is a single-page **React + TypeScript** app built with **Vite**. All backend services are hosted (Firebase and Algolia), so there is no server to run locally.

Live at <https://stuff-11062.web.app>.

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`. Everything is behind Google Sign-In; until you sign in you only see the sign-in button.

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

Opening an item or its edit page updates its `lastViewed` timestamp, which drives the "Last viewed" list.

## Data model

Items live in the Firestore collection **`items`** of the Firebase project **`stuff-11062`**. Each item has `name`, `kind`, a set of other fields, and `lastEdited` / `lastViewed` timestamps.

The fields are defined in [`src/schema.ts`](src/schema.ts): their type (number, string, markdown, url, image, select) and which item kinds they apply to. The add/edit form and the item page are generated from that list, so a new field or kind only needs to be added there. Fields stored on an item that are not in the schema are still shown on its page, under their raw key.

Photos are uploaded to Firebase Storage under `item-images/` and stored on the item as a download URL.

## Services and access

- **Auth:** Google Sign-In, exchanged for a Firebase Auth session.
- **Firestore and Storage:** [`firestore.rules`](firestore.rules) and [`storage.rules`](storage.rules) allow reads and writes only for two hardcoded email addresses.
- **Search:** the home page queries the Algolia index **`global`** with a search-only key. Keeping that index in sync with Firestore happens outside this repository. The index is readable by anyone who has the key, which ships in the client bundle, regardless of the Firestore rules.

Firebase config and Algolia keys are hardcoded in [`src/firebase.ts`](src/firebase.ts) and [`src/algolia.ts`](src/algolia.ts). They are client-side keys, not secrets; there are no `.env` files.

## Deployment

GitHub Actions deploys to Firebase Hosting:

- every push to `master` goes to the live site;
- every pull request from this repository gets a preview channel.

The workflows deploy hosting only. Rule changes have to be deployed by hand:

```bash
firebase deploy --only firestore:rules,storage
```
