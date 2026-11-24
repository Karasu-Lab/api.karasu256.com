import { z } from 'zod';
import { signRequest } from '@karasu-lab/utils/server';
import { vercelProtectionBypassHeaders } from '@karasu-lab/utils/server/vercel-bypass';

export interface AuthSession {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface SessionDeviceSource {
  sessionId: string;
  userId: string;
  source: string;
}

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string(),
  htmlUrl: z.string(),
});

const githubRepositoriesSchema = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    fullName: z.string(),
    private: z.boolean(),
    htmlUrl: z.string(),
    description: z.string().nullable(),
    language: z.string().nullable(),
    updatedAt: z.string(),
  })
);

type GitHubUser = z.infer<typeof githubUserSchema>;
type GitHubRepository = z.infer<typeof githubRepositoriesSchema>[number];

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
  return (await res.json()) as AuthSession[];
}

export async function fetchSessionDeviceSources(env: Env, userId: string, sessionId?: string): Promise<SessionDeviceSource[]> {
  const path = sessionsPath(`/api/internal/users/${encodeURIComponent(userId)}/session-sources`, sessionId);
  const res = await signedAuthApiFetch(env, path, 'GET');
  if (!res.ok) throw new Error(`api-auth.karasu256.com responded ${res.status} for ${res.url}`);
  return (await res.json()) as SessionDeviceSource[];
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
