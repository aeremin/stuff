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
When you are not signed in, you will see a **“Sign in with Google”** button; after signing in, the app shows a personalized, authorized page with your Google profile information and a **Sign out** button.

## Inventory items (`/item/:id`)

Item pages at `/item/<id>` are **available only to logged-in users**. Each page fetches and displays the document with the given `id` from the Firestore **inventory** collection in the **alice-larp** Google Cloud project.

