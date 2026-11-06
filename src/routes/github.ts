import { Elysia } from 'elysia';
import { isPermitted, type RouteAuthContext } from '@karasu-lab/api-permissions';
import { authenticate } from '../lib/auth';
import { fetchGithubRepositories, fetchGithubUser } from '../lib/auth-api';

type Guarded = { auth: RouteAuthContext | null; set: { status?: number | string } };

function requirePermission(permission: string) {
  return ({ auth, set }: Guarded) => {
    if (!auth) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    if (!isPermitted(auth, permission)) {
      set.status = 403;
      return { error: 'insufficient_scope' };
    }
  };
}

export const githubRoutes = (env: Env) =>
  new Elysia({ prefix: '/github' })
    .derive(async ({ request }) => ({ auth: await authenticate(request, env) }))
    .get(
      '/user',
      async ({ auth, set }) => {
        const user = await fetchGithubUser(env, auth!.userId);
        if (!user) {
          set.status = 404;
          return { error: 'github_not_linked' };
        }
        return user;
      },
      { beforeHandle: requirePermission('github:user.read') }
    )
    .get(
      '/avatar',
      async ({ auth, set }) => {
        const user = await fetchGithubUser(env, auth!.userId);
        if (!user) {
          set.status = 404;
          return { error: 'github_not_linked' };
        }
        const upstream = await fetch(user.avatarUrl);
        if (!upstream.ok) {
          set.status = 502;
          return { error: 'github_avatar_unavailable' };
        }
        return new Response(upstream.body, {
          headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream' },
        });
      },
      { beforeHandle: requirePermission('github:avatar.read') }
    )
    .get(
      '/repositories',
      async ({ auth, set }) => {
        const repositories = await fetchGithubRepositories(env, auth!.userId);
        if (!repositories) {
          set.status = 404;
          return { error: 'github_not_linked' };
        }
        return repositories;
      },
      { beforeHandle: requirePermission('github:repositories.read') }
    );
