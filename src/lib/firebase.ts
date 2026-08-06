import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore'; 
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

interface FirebaseAppletConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

// Initialize Firestore with default fast connection
const config = firebaseConfig as FirebaseAppletConfig;
const dbId = config.firestoreDatabaseId || '(default)';
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId);

// Enable offline cache persistence for extreme stability and offline capability
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('AURUM PERSISTENCE ⚠️: Multi-tab persistence failed-precondition (multiple tabs active).');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('AURUM PERSISTENCE ⚠️: Browser does not support Firestore offline persistence.');
    } else {
      console.warn('AURUM PERSISTENCE ⚠️: Error enabling offline persistence:', err);
    }
  });
}

// Initialize Auth
const auth = getAuth(app);

// Explicitly set persistence to Local
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Auth persistence error:", err);
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Only throw for write and mutation operations where callers await and handle exceptions.
  // For GET or LIST listeners, throwing creates asynchronous uncaught exceptions.
  if (operationType === OperationType.CREATE || 
      operationType === OperationType.UPDATE || 
      operationType === OperationType.DELETE || 
      operationType === OperationType.WRITE) {
    throw new Error(JSON.stringify(errInfo));
  }
}

export { app, auth, db };
export default app;
