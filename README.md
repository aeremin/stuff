# Hello World React App

This is a minimal **React + TypeScript** web app created with **Vite**.

## Scripts

- **`npm run dev`** – start the development server
- **`npm run build`** – build for production
- **`npm run preview`** – preview the production build locally

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`) in your browser to see the app.

## Google authorization

This app uses **Google Identity Services** on the client to show different content depending on whether the user is signed in.

1. Create an **OAuth 2.0 Client ID** for a web app in the Google Cloud Console.
2. Add your local dev URL (for example `http://localhost:5173`) as an authorized JavaScript origin.
3. Copy your **Client ID** and set it in a `.env.local` file at the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=your-real-client-id
```

Restart `npm run dev`.  
When you are not signed in, you will see a **“Sign in with Google”** button; after signing in, the app shows a personalized, authorized page with your Google profile information and a **Sign out** button.

## Inventory items (`/item/:id`)

Item pages at `/item/<id>` are **available only to logged-in users**. Each page fetches and displays the document with the given `id` from the Firestore **inventory** collection in the **alice-larp** Google Cloud project.

### Firebase setup

1. In the [Firebase Console](https://console.firebase.google.com/), select or create a project (e.g. **alice-larp**).
2. Add a web app and copy the config object.
3. Create Firestore database and add an **inventory** collection with your documents.
4. Add these variables to `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=alice-larp.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=alice-larp
VITE_FIREBASE_STORAGE_BUCKET=alice-larp.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

5. Configure Firestore [security rules](https://firebase.google.com/docs/firestore/security/get-started) so only authenticated users can read the inventory collection.
6. Restart `npm run dev` and navigate to `/item/<document-id>` while logged in.
