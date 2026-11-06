import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PermissionService, type RouteAuthContext } from '@karasu-lab/api-permissions';
import { oauthTokenClaimsSchema } from '@karasu-lab/types/server';
import { vercelProtectionBypassHeaders } from '@karasu-lab/utils/server/vercel-bypass';
import { withDataSource } from '../db/data-source';
import { TypeOrmPermissionRepository } from '../db/typeorm-permission-repository';

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

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

export async function verifyApiKey(token: string, env: Env): Promise<{ userId: string; keyId: string; permissionIds: string[] } | null> {
  const res = await fetch(`${env.AUTH_URL}/api/api-keys/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...vercelProtectionBypassHeaders(env.VERCEL_PROTECTION_BYPASS_SECRET) },
    body: JSON.stringify({ key: token }),
  });
  if (!res.ok) return null;
  const { userId, keyId } = (await res.json()) as { userId: string; keyId: string };
  const permissionIds = await withDataSource(env, (dataSource) => new PermissionService(new TypeOrmPermissionRepository(dataSource)).resolve(keyId));
  return { userId, keyId, permissionIds };
}

async function authenticateApiKey(token: string, env: Env): Promise<RouteAuthContext | null> {
  const verified = await verifyApiKey(token, env);
  if (!verified) return null;
  return { userId: verified.userId, authMethod: 'apiKey', permissionIds: verified.permissionIds, scopes: null };
}

async function verifyOauthToken(token: string, env: Env): Promise<RouteAuthContext | null> {
  const issuer = oauthIssuer(env);
  try {
    const { payload } = await jwtVerify(token, getJwks(issuer), { issuer, audience: issuer });
    const parsed = oauthTokenClaimsSchema.safeParse(payload);
    if (!parsed.success) return null;
    const scopes = parsed.data.scope !== undefined ? parsed.data.scope.split(' ') : [];
    return { userId: parsed.data.sub, authMethod: 'oauthApp', permissionIds: null, scopes };
  } catch {
    return null;
  }
}

export async function verifySessionJwt(token: string, env: Env): Promise<RouteAuthContext | null> {
  const { payload } = await jwtVerify(token, getJwks(oauthIssuer(env)), { issuer: env.AUTH_URL, audience: env.AUTH_URL });
  const parsed = oauthTokenClaimsSchema.safeParse(payload);
  if (!parsed.success) return null;
  return { userId: parsed.data.sub, authMethod: 'session', permissionIds: null, scopes: null };
}

export async function authenticate(request: Request, env: Env): Promise<RouteAuthContext | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  if (!token) return null;
  const session = () => verifySessionJwt(token, env).catch(() => null);
  return (await verifyOauthToken(token, env)) ?? (await session()) ?? (await authenticateApiKey(token, env));
}

export function isInternalCaller(request: Request, env: Env): boolean {
  return request.headers.get('authorization') === `Bearer ${env.INTERNAL_API_SECRET}`;
}
