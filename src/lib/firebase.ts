import { importPKCS8, SignJWT } from 'jose';
import { FirebaseRequestError } from './firebase-request-error';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

let cachedToken: { value: string; expiresAt: number } | undefined;

async function getAccessToken(env: Env): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const key = await importPKCS8(env.FIREBASE_ADMIN_PRIVATE_KEY, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(env.FIREBASE_ADMIN_CLIENT_EMAIL)
    .setSubject(env.FIREBASE_ADMIN_CLIENT_EMAIL)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('55m')
    .sign(key);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new FirebaseRequestError();

  const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

async function identityToolkit<T>(env: Env, path: string, body: unknown): Promise<T> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_ADMIN_PROJECT_ID}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken(env)}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new FirebaseRequestError();
  return (await response.json()) as T;
}

export async function getFirebasePhotoURL(env: Env, uid: string): Promise<string | null> {
  const { users } = await identityToolkit<{ users?: { photoUrl?: string }[] }>(env, '/accounts:lookup', { localId: [uid] });
  return users?.[0]?.photoUrl ?? null;
}

export async function setFirebasePhotoURL(env: Env, uid: string, photoURL: string | null): Promise<void> {
  await identityToolkit(
    env,
    '/accounts:update',
    photoURL === null ? { localId: uid, deleteAttribute: ['PHOTO_URL'] } : { localId: uid, photoUrl: photoURL }
  );
}
