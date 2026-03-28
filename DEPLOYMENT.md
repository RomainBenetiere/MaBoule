# Sourdough Analytics — Firebase Deployment Guide

## Prerequisites

1. **Node.js** ≥ 18 and **npm** installed.
2. A **Firebase project** created at [console.firebase.google.com](https://console.firebase.google.com).
3. **Firebase CLI** installed:
   ```bash
   npm install -g firebase-tools
   ```

---

## 1. Configure Firebase Credentials

Copy `.env.example` → `.env` and fill in your Firebase project values:

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_FIREBASE_API_KEY=AIza…
VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-project
VITE_FIREBASE_STORAGE_BUCKET=my-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## 2. Enable Firebase Services

In the Firebase Console:

1. **Authentication** → Sign-in method → Enable **Email/Password**.
2. **Firestore Database** → Create database → Start in **production mode**.

---

## 3. Deploy Firestore Rules

```bash
firebase login
firebase init firestore   # Select existing project, accept defaults
firebase deploy --only firestore:rules
```

The `firestore.rules` file in this repo will be used.

---

## 4. Build for Production

```bash
npm run build
```

This creates a `dist/` folder with the production bundle.

---

## 5. Deploy to Firebase Hosting

```bash
firebase init hosting
```

When prompted:
- **Public directory:** `dist`
- **Single-page app:** Yes
- **GitHub auto-deploys:** No

Then deploy:

```bash
firebase deploy --only hosting
```

---

## 6. Create Firestore Indexes (if needed)

If the console shows an index-required error, Firestore will provide a direct link to create the needed composite index:

- Collection: `users/{userId}/sessions`
- Fields: `metadata.status` (ASC) + `metadata.completed_at` (DESC)

---

## Local Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.
