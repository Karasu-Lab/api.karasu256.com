import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PermissionService, type Permission, type RouteAuthContext } from '@Hashibutogarasu/api-permissions';
import { vercelProtectionBypassHeaders } from '@Hashibutogarasu/utils/server/vercel-bypass';
import { withDataSource } from '../db/data-source';
import { TypeOrmPermissionRepository } from '../db/typeorm-permission-repository';

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** better-auth's issuer, audience and JWKS live under its `/api/auth` mount path, not the bare origin. */
function oauthIssuer(env: Env): string {
  return `${env.AUTH_URL}/api/auth`;
}

function getJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwksByIssuer.get(issuer);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/jwks`));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
}

/** Key validity stays with better-auth in auth.karasu256.com; which permissions the key carries is resolved here. */
export async function verifyApiKey(token: string, env: Env): Promise<{ userId: string; keyId: string; permissions: Permission[] } | null> {
  const res = await fetch(`${env.AUTH_URL}/api/api-keys/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...vercelProtectionBypassHeaders(env.VERCEL_PROTECTION_BYPASS_SECRET) },
    body: JSON.stringify({ key: token }),
  });
  if (!res.ok) return null;
  const { userId, keyId } = (await res.json()) as { userId: string; keyId: string };
  const permissions = await withDataSource(env, (dataSource) => new PermissionService(new TypeOrmPermissionRepository(dataSource)).resolve(keyId));
  return { userId, keyId, permissions };
}

async function authenticateApiKey(token: string, env: Env): Promise<RouteAuthContext | null> {
  const verified = await verifyApiKey(token, env);
  if (!verified) return null;
  return { userId: verified.userId, authMethod: 'apiKey', permissions: verified.permissions, scopes: null };
}

async function verifyOauthToken(token: string, env: Env): Promise<RouteAuthContext | null> {
  const issuer = oauthIssuer(env);
  try {
    const { payload } = await jwtVerify(token, getJwks(issuer), { issuer, audience: issuer });
    if (!payload.sub) return null;
    const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
    return { userId: payload.sub, authMethod: 'oauthApp', permissions: null, scopes };
  } catch {
    return null;
  }
}

/** better-auth's jwt plugin signs session JWTs (`set-auth-jwt` on `get-session`) with the same keys, but issued for the bare origin. */
async function verifySessionJwt(token: string, env: Env): Promise<RouteAuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(oauthIssuer(env)), { issuer: env.AUTH_URL, audience: env.AUTH_URL });
    if (!payload.sub) return null;
    return { userId: payload.sub, authMethod: 'session', permissions: null, scopes: null };
  } catch {
    return null;
  }
}

export async function authenticate(request: Request, env: Env): Promise<RouteAuthContext | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  if (!token) return null;
  return (await verifyOauthToken(token, env)) ?? (await verifySessionJwt(token, env)) ?? (await authenticateApiKey(token, env));
}

/** Service-to-service calls from accounts carry a shared secret instead of a user credential. */
export function isInternalCaller(request: Request, env: Env): boolean {
  return request.headers.get('authorization') === `Bearer ${env.INTERNAL_API_SECRET}`;
}
