# Improvement plan

A review of the whole repository (web app, MCP server, rules and CI) from November 2026. Items marked ✅ have been done since; line numbers refer to the code as it was at the time of the review.

**Overall:** the code is in good shape. It type-checks and builds cleanly. The MCP/OAuth server is careful work: tokens are stored only as hashes, authorization codes are single-use and checked inside transactions, refresh tokens rotate, and every request re-checks the allowed-email list. Most of what needs work is in the web app.

**Suggested order:** Phase 1, then the Algolia and rules work in Phase 2, then Phases 3 and 4 together, then whichever features from Phase 5 are wanted.

## Phase 1 — Bug fixes (small, do first)

1. ✅ *Done: the link text is passed through again, and `node` is kept out of the HTML.* **Links in markdown render with no text.** [`src/components/MarkdownView.tsx:18`](../src/components/MarkdownView.tsx) pulls `children` out of the props and never passes it on. Rendering a link gives `<a href="…" node="[object Object]" target="_blank"></a>`: the link is invisible, and an internal `node` prop also ends up in the HTML.
2. ✅ *Done: number inputs have `step="any"` (the +/- buttons still change the value by 1) and `inputMode="decimal"`. A value that isn't a number shows an error naming the field instead of being saved as 0; a blank field is still saved as 0. (Chrome did let `100.5` through with no `step` after all, so the original report was only partly right.)* **The form rejects decimal numbers.** The number inputs at [`src/pages/ItemForm.tsx:201`](../src/pages/ItemForm.tsx) have no `step`, so the browser only accepts whole numbers. In Chromium, `2.5` and `0.05` fail with "Please enter a valid value", and the form won't submit. That makes shank diameter, price per piece and weight impossible to enter. Separately, input that can't be parsed (e.g. `2,5`) is saved as `0` without a warning (`ItemForm.tsx:80`). Fix: add `step="any"` and `inputMode="decimal"`, and show an error instead of storing 0.
3. ✅ *Done: the app now follows Firebase Auth (`src/auth.ts`). The "account isn't allowed" message was left out on purpose: it would cost a Firestore read on every load.* **Whether the user is signed in comes from a browser flag, not Firebase Auth** ([`src/App.tsx:162`](../src/App.tsx)). This causes three problems:
   - If Firebase sign-in fails, the app still shows the user as signed in (`App.tsx:96-100`).
   - When the Firebase session expires, the full app is shown but every request fails with permission errors.
   - If Google's sign-in script loads after React has mounted, the sign-in button may never appear, because the effect doesn't run again (`App.tsx:80`). This was worked out from the code, not reproduced.

   Fix: treat `onAuthStateChanged` as the only source of truth, sign in with `signInWithPopup(GoogleAuthProvider)`, and remove the Google sign-in script, the manual token parsing and the `revoke` call on sign-out. Also show a clear "this account isn't allowed" message.

## Phase 2 — Security and privacy

1. ✅ *Done: the web app searches through `POST /api/search` on the Cloud Function ([`functions/src/search.ts`](../functions/src/search.ts)), which checks the Firebase ID token against the allowed emails. The function and MCP search share one code path and read the key from the `ALGOLIA_SEARCH_KEY` secret. No Algolia key ships to the browser any more, and `algoliasearch` is out of the web bundle. The old key is still in git history, so it has to be deleted in the Algolia dashboard.* **Anyone can read the whole inventory through Algolia.** The search-only key ships in the page's JavaScript, and the Firestore rules don't apply to Algolia. Move the web app's search into the existing Cloud Function (it checks the Firebase ID token, much as MCP search already runs server-side), then restrict or rotate the public key, which [`functions/src/config.ts`](../functions/src/config.ts) uses too. The alternative is having the function issue short-lived Algolia keys.
2. **Make the security rules safer:**
   - ✅ *Done: both rules files require `email_verified`; the function already did.* Add `request.auth.token.email_verified == true`. This only matters if another sign-in method, such as email/password, is ever turned on, but it costs nothing.
   - ✅ *Done: the rules and the function ([`functions/src/access.ts`](../functions/src/access.ts)) check an `admin` custom claim instead of email addresses. There is no script: the claim is set by hand on the two accounts. MCP tokens are re-checked against the user's current claims in Firebase Auth (cached for a minute).* The list of allowed emails exists in three copies ([`firestore.rules`](../firestore.rules), [`storage.rules`](../storage.rules), [`functions/src/config.ts`](../functions/src/config.ts)). Replacing them with an `admin` flag on the user account (a Firebase custom claim, set once by a small script) would leave a single list.
   - ✅ *Done: [`firestore.rules`](../firestore.rules) only open `items`, the one collection the web app uses; everything else is closed to browsers.* Block browser access to the `mcp*` collections; only the function needs them.
3. **Allow only `http(s)` links in URL fields.** The web form's URL input accepts `javascript:` links; the MCP server already only accepts http(s). Low priority, since only the two allowed accounts can write.
4. ✅ *Done: every push to `master` deploys the Firestore and Storage rules and the Firestore indexes before functions and Hosting, and pull requests compile them with `--dry-run`. The deploy runs without `--force`, so indexes that exist only in the project are reported, not deleted. The service account needs Firebase Rules Admin and Cloud Datastore Index Admin on top of its current roles.* **Deploy rules and indexes from CI** instead of by hand, so what's deployed can't drift from the repo.

## Phase 3 — Code structure

✅ *Done. All signed-in pages share one layout route (`AppLayout` in `src/App.tsx`), with a 404 page. `src/useItem.ts` and `src/components/ItemList.tsx` replace the duplicated code. `/purefil` is loaded on demand; the main bundle is now 881 KB (256 KB gzipped), and the Purefil chunk is 506 KB. The home page is now as wide as the other pages (720 px instead of 640 px). `useItem` returns the item with its `id` (it used to be stored without one, so `key={item.id}` was `undefined`), and `AddItemPage` now imports `INVENTORY_COLLECTION` instead of defining its own copy.*

- **Routing:** [`src/App.tsx`](../src/App.tsx) repeats the header wrapper six times. Replace it with one layout route using `<Outlet/>`, and add a 404 route.
- **Shared code:**
  - A `useItem(id)` hook for the item-loading code duplicated in `ItemPage` and `EditItemPage`.
  - An `ItemList` component for the two identical lists in `HomePage`.
- **Simplify [`src/firebase.ts`](../src/firebase.ts):** the "Firebase not configured" branches can never run, since the config is hardcoded. Removing them also removes the `db!` / `auth?` checks throughout the app.
- **Bundle size:** everything ships as one 1.39 MB file (412 KB gzipped). Loading `/purefil` on demand would keep the chart library and the Pantone colour table out of the main page.
- **Algolia client:** create it once instead of on every search ([`src/algolia.ts:28`](../src/algolia.ts)).

## Phase 4 — CI and tests

- **Check the functions on pull requests.** The PR workflow ([`.github/workflows/firebase-hosting-pull-request.yml`](../.github/workflows/firebase-hosting-pull-request.yml)) never builds `functions/`, so a type error there only shows up when deploying from `master`. Add the functions build, and `setup-node`, to the PR workflow.
- **Add Vitest** for the pure logic: the schema helpers, [`functions/src/items.ts`](../functions/src/items.ts) (`toStoredFields`, `serializeItem`), the form's save logic once it's pulled out of the component, and the Purefil colour matching. Optionally, test the OAuth code against the Firestore emulator.

## Phase 5 — Feature ideas

- **Location / container** for each item. For an asset tracker this is the biggest gap: there's no way to record where something is. It pairs well with NFC tags on boxes: a box page that lists what's inside.
- **Quick ±amount buttons** on the item page, using Firestore's atomic `increment()`, plus a low-stock threshold and a "running low" list.
- **Delete or archive** items, and **"Duplicate as new"** for making screw variants.
- **Browse by kind.** Right now the home page only offers search and the five last-viewed items.
- **Shrink photos before upload.** Phone photos are several MB. (The item page now shows generated thumbnails, see `functions/src/thumbnails.ts`.) Also delete images that are replaced or removed; they're currently left in storage (their thumbnails are deleted).
- **Printable QR labels** as an alternative to NFC, since Web NFC doesn't work on iPhones.
- **Generalize `/purefil`** to any filament brand, and link to it from the app.
- *(Bigger, optional)* Store blank numbers as "not set" instead of `0`. That removes the "is 0 a real value?" guessing noted at [`functions/src/items.ts:108`](../functions/src/items.ts), but it needs a data migration and an MCP change.
