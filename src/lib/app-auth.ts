import { decodeJwt, importSPKI, jwtVerify, type JWTPayload } from 'jose';

interface AppTokenPayload extends JWTPayload {
  method?: string;
  path?: string;
  bodySha256?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function spkiFromBase64(base64: string): string {
  const lines = base64.replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

export function internalUserId(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'internal' || segments[1] !== 'users' || !segments[2]) return null;
  return decodeURIComponent(segments[2]);
}

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

interface RegisteredApp {
  id: string;
  publicKey: string;
}

function registeredApps(env: Env): RegisteredApp[] {
  const apps: RegisteredApp[] = [{ id: env.ACCOUNTS_APP_ID, publicKey: env.ACCOUNTS_APP_PUBLIC_KEY }];
  if (env.MCP_APP_ID && env.MCP_APP_PUBLIC_KEY) {
    apps.push({ id: env.MCP_APP_ID, publicKey: env.MCP_APP_PUBLIC_KEY });
  }
  return apps;
}

export async function verifyAppToken(request: Request, env: Env, bodyText: string): Promise<boolean> {
  const token = request.headers.get('x-app-token');
  if (!token) return false;

  let issuer: string | undefined;
  try {
    issuer = decodeJwt(token).iss;
  } catch {
    return false;
  }
  const app = registeredApps(env).find((candidate) => candidate.id === issuer);
  if (!app) return false;

  const url = new URL(request.url);
  const userId = internalUserId(url.pathname);
  if (!userId) return false;

  let payload: AppTokenPayload;
  try {
    const key = await importSPKI(spkiFromBase64(app.publicKey), 'EdDSA');
    const verified = await jwtVerify(token, key, {
      algorithms: ['EdDSA'],
      issuer: app.id,
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
