import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

/* ------------------------------------------------------------------ */
/*  Firebase init                                                      */
/* ------------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase config is present
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (err) {
    console.error('Firebase initialization failed:', err);
  }
}

export { auth, db, storage };

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

/** Upload a photo to Firebase Storage and return its download URL */
export async function uploadSessionPhoto(userId, sessionId, stepKey, file) {
  if (!storage) throw new Error('Firebase Storage not configured');
  const ext = file.name?.split('.').pop() || 'jpg';
  const filename = `${stepKey}_${Date.now()}.${ext}`;
  const path = `users/${userId}/sessions/${sessionId}/${filename}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/* ------------------------------------------------------------------ */
export const signup = (email, password) => {
  if (!auth) return Promise.reject(new Error('Firebase not configured. Add your .env file.'));
  return createUserWithEmailAndPassword(auth, email, password);
};

export const login = (email, password) => {
  if (!auth) return Promise.reject(new Error('Firebase not configured. Add your .env file.'));
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = () => {
  if (!auth) return Promise.resolve();
  return signOut(auth);
};

export { onAuthStateChanged };

/* ------------------------------------------------------------------ */
/*  Firestore helpers                                                  */
/* ------------------------------------------------------------------ */

/** Get or create user preferences (initial hydration, etc.) */
export async function getUserPreferences(userId) {
  if (!db) return null;
  const ref = doc(db, 'users', userId, 'settings', 'preferences');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setUserPreferences(userId, data) {
  if (!db) return;
  const ref = doc(db, 'users', userId, 'settings', 'preferences');
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** Create a new baking session */
export async function createSession(userId) {
  if (!db) throw new Error('Firebase not configured');
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const newRef = doc(sessionsRef);
  const session = {
    xs_data: {},
    ys_data: {},
    metadata: {
      status: 'in_progress',
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      form_factor_multiplier: 1.0,
    },
  };
  await setDoc(newRef, session);
  return { id: newRef.id, ...session };
}

/** Update a specific step in xs_data or ys_data */
export async function updateSessionStep(userId, sessionId, path, data, extraMetadata = {}) {
  if (!db) return;
  const ref = doc(db, 'users', userId, 'sessions', sessionId);
  const updates = {
    [path]: data,
    'metadata.updated_at': Timestamp.now(),
  };
  for (const [k, v] of Object.entries(extraMetadata)) {
    updates[`metadata.${k}`] = v;
  }
  await updateDoc(ref, updates);
}

/** Mark a session as completed */
export async function completeSession(userId, sessionId, finalData) {
  if (!db) return;
  const ref = doc(db, 'users', userId, 'sessions', sessionId);
  await updateDoc(ref, {
    ...finalData,
    'metadata.status': 'completed',
    'metadata.completed_at': Timestamp.now(),
    'metadata.updated_at': Timestamp.now(),
  });
}

/** Get an in-progress session (for resuming) */
export async function getInProgressSession(userId) {
  if (!db) return null;
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const q = query(
    sessionsRef,
    where('metadata.status', '==', 'in_progress'),
    orderBy('metadata.created_at', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/** Get the last completed session (for H_prev) */
export async function getLastCompletedSession(userId) {
  if (!db) return null;
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const q = query(
    sessionsRef,
    where('metadata.status', '==', 'completed'),
    orderBy('metadata.completed_at', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/** Get all completed sessions for analytics */
export async function getUserSessions(userId) {
  if (!db) return [];
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const q = query(
    sessionsRef,
    where('metadata.status', '==', 'completed'),
    orderBy('metadata.completed_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
