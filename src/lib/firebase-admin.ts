import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

const ADMIN_APP_NAME = 'firebase-admin';

/**
 * The Firebase Admin app for this worker. Firebase access is proxied
 * through this API: first-party apps never hold Firebase credentials
 * or talk to Firebase themselves; they ask this worker, which alone
 * holds the service account.
 */
function getAdminApp(env: Env): App {
  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (existing) return existing;
  return initializeApp(
    {
      credential: cert({
        projectId: env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
      }),
    },
    ADMIN_APP_NAME
  );
}

/** Returns a Firebase Admin Auth instance bound to the named admin app. */
export function getAdminAuth(env: Env): Auth {
  return getAuth(getAdminApp(env));
}
