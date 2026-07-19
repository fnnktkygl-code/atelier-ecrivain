/**
 * Firebase Configuration
 *
 * ⚠️ IMPORTANT: Replace this config with your own Firebase project config.
 *
 * To get your config:
 * 1. Go to Firebase Console → Project Settings → General
 * 2. Under "Your apps", select your web app
 * 3. Copy the firebaseConfig object
 *
 * Or run: npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID>
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

let app: FirebaseApp;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existing = getApps();
    app = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}
