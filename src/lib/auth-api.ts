import { z } from 'zod';
import {
  authSessionSchema,
  githubRepositorySchema,
  githubUserSchema,
  sessionDeviceSourceSchema,
  type AuthSession,
  type GitHubRepository,
  type GitHubUser,
  type SessionDeviceSource,
} from '@karasu-lab/types/shared';
import { signRequest } from '@karasu-lab/utils/server';
import { vercelProtectionBypassHeaders } from '@karasu-lab/utils/server/vercel-bypass';

const authSessionsSchema = z.array(authSessionSchema);
const sessionDeviceSourcesSchema = z.array(sessionDeviceSourceSchema);
const githubRepositoriesSchema = z.array(githubRepositorySchema);

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

function sessionsPath(base: string, sessionId?: string): string {
  return sessionId ? `${base}?sessionId=${encodeURIComponent(sessionId)}` : base;
}

export async function fetchAuthSessions(env: Env, userId: string, sessionId?: string): Promise<AuthSession[]> {
  const path = sessionsPath(`/api/internal/users/${encodeURIComponent(userId)}/sessions`, sessionId);
  const res = await signedAuthApiFetch(env, path, 'GET');
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return authSessionsSchema.parse(await res.json());
}

export async function fetchSessionDeviceSources(env: Env, userId: string, sessionId?: string): Promise<SessionDeviceSource[]> {
  const path = sessionsPath(`/api/internal/users/${encodeURIComponent(userId)}/session-sources`, sessionId);
  const res = await signedAuthApiFetch(env, path, 'GET');
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return sessionDeviceSourcesSchema.parse(await res.json());
}

export async function fetchGithubUser(env: Env, userId: string): Promise<GitHubUser | null> {
  const res = await signedAuthApiFetch(env, `/api/internal/users/${encodeURIComponent(userId)}/github/user`, 'GET');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return githubUserSchema.parse(await res.json());
}

export async function fetchGithubRepositories(env: Env, userId: string): Promise<GitHubRepository[] | null> {
  const res = await signedAuthApiFetch(env, `/api/internal/users/${encodeURIComponent(userId)}/github/repositories`, 'GET');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return githubRepositoriesSchema.parse(await res.json());
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
