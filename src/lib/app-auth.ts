import { decodeJwt, importSPKI, jwtVerify, type JWTPayload } from 'jose';

/**
 * Application-token authentication for the accounts site's calls to
 * the internal user endpoints.
 *
 * The caller proves it is the genuine app with its own short-lived
 * token — a compact JWS (EdDSA) issued per request by the app's
 * server side. The token's issuer is the app ID registered here, its
 * audience is this worker's origin, its subject is the user the call
 * acts for, and its claims bind the method, the path and a hash of
 * the body, so a captured token cannot be replayed against another
 * request. The signing key's private half never leaves the accounts
 * deployment; this worker holds only the public half.
 *
 * This proves the application only. The user is proven separately by
 * their better-auth session token (see verifySessionJwt), and both
 * proofs must name the same user before a call is served.
 */
interface AppTokenPayload extends JWTPayload {
  method?: string;
  path?: string;
  bodySha256?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Wraps a base64-encoded SPKI key in PEM armor for jose's importer. */
function spkiFromBase64(base64: string): string {
  const lines = base64.replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

/** The user ID an internal user path names (`/internal/users/:userId/...`), or null for other paths. */
export function internalUserId(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'internal' || segments[1] !== 'users' || !segments[2]) return null;
  return decodeURIComponent(segments[2]);
}

/**
 * Token IDs already presented to this worker instance, mapped to the
 * token's expiry. Tokens are single-use: a second presentation of the
 * same ID is rejected for as long as this instance remembers it.
 * Instances are short-lived, so this bounds replay to the token's own
 * lifetime even where an ID is forgotten.
 */
const seenTokenIds = new Map<string, number>();

function consumeTokenId(jti: string, exp: number): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const [id, expiry] of seenTokenIds) {
    if (expiry <= nowSeconds) seenTokenIds.delete(id);
  }
  if (seenTokenIds.has(jti)) return false;
  seenTokenIds.set(jti, exp);
  return true;
}

/**
 * Verifies the application token on a request to an internal user
 * endpoint. `bodyText` is the request body read by the caller (empty
 * for bodyless methods); the token must have been issued for exactly
 * this method, path, body and user.
 */
export async function verifyAppToken(request: Request, env: Env, bodyText: string): Promise<boolean> {
  const token = request.headers.get('x-app-token');
  if (!token) return false;

  let issuer: string | undefined;
  try {
    issuer = decodeJwt(token).iss;
  } catch {
    return false;
  }
  if (issuer !== env.ACCOUNTS_APP_ID) return false;

  const url = new URL(request.url);
  const userId = internalUserId(url.pathname);
  if (!userId) return false;

  let payload: AppTokenPayload;
  try {
    const key = await importSPKI(spkiFromBase64(env.ACCOUNTS_APP_PUBLIC_KEY), 'EdDSA');
    const verified = await jwtVerify(token, key, {
      algorithms: ['EdDSA'],
      issuer: env.ACCOUNTS_APP_ID,
      audience: url.origin,
    });
    payload = verified.payload as AppTokenPayload;
  } catch {
    return false;
  }

  if (payload.sub !== userId) return false;
  if (typeof payload.jti !== 'string' || !payload.jti) return false;
  if (typeof payload.exp !== 'number' || !consumeTokenId(payload.jti, payload.exp)) return false;
  if (payload.method !== request.method) return false;
  if (payload.path !== url.pathname) return false;
  if (payload.bodySha256 !== (await sha256Hex(bodyText))) return false;
  return true;
}
