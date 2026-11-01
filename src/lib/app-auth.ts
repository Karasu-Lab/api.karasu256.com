import { importSPKI, jwtVerify } from 'jose';

/**
 * Application-signature authentication for service-to-service calls.
 *
 * A first-party app proves it is itself with two things only: its app
 * ID and the private key registered against that ID here (the public
 * half lives in this worker's environment). The app signs a compact
 * JWS (EdDSA) whose payload binds the request — method, path and a
 * hash of the body — to a short-lived timestamp, and sends it in the
 * `x-app-signature` header. No shared secret is involved, so one app's
 * credential cannot speak for another.
 */
const MAX_SKEW_SECONDS = 300;

interface AppSignaturePayload {
  iss: string;
  iat: number;
  method: string;
  path: string;
  bodySha256: string;
}

/** The public key registered for an app ID, or null when the app is not trusted here. */
function trustedPublicKey(appId: string, env: Env): string | null {
  if (appId !== env.ACCOUNTS_APP_ID) return null;
  return env.ACCOUNTS_APP_PUBLIC_KEY;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies the application signature on a request to an internal
 * endpoint. The body is read (and thereby consumed) only when present;
 * callers that need it afterwards should parse it from the same text.
 */
export async function verifyAppSignature(request: Request, env: Env, bodyText: string): Promise<boolean> {
  const token = request.headers.get('x-app-signature');
  if (!token) return false;

  let iss: string;
  let payload: AppSignaturePayload;
  try {
    const probe = JSON.parse(new TextDecoder().decode(base64UrlDecode(token.split('.')[1] ?? ''))) as AppSignaturePayload;
    iss = probe.iss;
    payload = probe;
  } catch {
    return false;
  }

  const publicKey = trustedPublicKey(iss, env);
  if (!publicKey) return false;

  try {
    const key = await importSPKI(spkiFromBase64(publicKey), 'EdDSA');
    const { payload: verified } = await jwtVerify(token, key, { algorithms: ['EdDSA'], currentDate: new Date() });
    payload = verified as unknown as AppSignaturePayload;
  } catch {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - payload.iat) > MAX_SKEW_SECONDS) return false;

  const url = new URL(request.url);
  if (payload.method !== request.method) return false;
  if (payload.path !== url.pathname) return false;
  if (payload.bodySha256 !== (await sha256Hex(bodyText))) return false;
  return true;
}

function base64UrlDecode(segment: string): Uint8Array {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Wraps a base64-encoded SPKI key in PEM armor for jose's importer. */
function spkiFromBase64(base64: string): string {
  const lines = base64.replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}
