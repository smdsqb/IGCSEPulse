"use client";

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== "undefined";
const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

// Guard initialization so build-time prerender does not crash when env vars are missing.
const app = isBrowser && hasFirebaseConfig
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;
const auth = app ? getAuth(app) : null;
const googleProvider = auth ? new GoogleAuthProvider() : null;

function getAuthServices() {
  if (!auth || !googleProvider) {
    throw new Error(
      "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables in your environment."
    );
  }
  return { auth, googleProvider };
}

// ── Auth helpers ────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const { auth, googleProvider } = getAuthServices();
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, password: string) {
  const { auth } = getAuthServices();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(email: string, password: string) {
  const { auth } = getAuthServices();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function logout() {
  const { auth } = getAuthServices();
  await signOut(auth);
}

export function subscribeToAuthStateChanged(callback: (user: User | null) => void) {
  if (!auth) {
    return () => { };
  }
  return onAuthStateChanged(auth, callback);
}

export { type User };
