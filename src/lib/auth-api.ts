import { z } from 'zod';
import { authSessionSchema, sessionDeviceSourceSchema, type AuthSession, type SessionDeviceSource } from '@karasu-lab/types/shared';
import { signRequest } from '@karasu-lab/utils/server';
import { vercelProtectionBypassHeaders } from '@karasu-lab/utils/server/vercel-bypass';

const authSessionsSchema = z.array(authSessionSchema);
const sessionDeviceSourcesSchema = z.array(sessionDeviceSourceSchema);

function signedAuthApiFetch(env: Env, path: string, method: string): Promise<Response> {
  const url = `${env.AUTH_URL}${path}`;
  return fetch(url, {
    method,
    headers: {
      ...signRequest({ secret: env.INTERNAL_API_SECRET, method, url, body: '' }),
      ...vercelProtectionBypassHeaders(env.VERCEL_PROTECTION_BYPASS_SECRET),
    },
  });
}

export async function fetchAuthSessions(env: Env, userId: string): Promise<AuthSession[]> {
  const res = await signedAuthApiFetch(env, `/api/internal/users/${encodeURIComponent(userId)}/sessions`, 'GET');
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return authSessionsSchema.parse(await res.json());
}

export async function fetchSessionDeviceSources(env: Env, userId: string): Promise<SessionDeviceSource[]> {
  const res = await signedAuthApiFetch(env, `/api/internal/users/${encodeURIComponent(userId)}/session-sources`, 'GET');
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return sessionDeviceSourcesSchema.parse(await res.json());
}

export async function deleteAuthSession(env: Env, userId: string, sessionId: string): Promise<boolean> {
  const res = await signedAuthApiFetch(
    env,
    `/api/internal/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
    'DELETE'
  );
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return true;
}
