import { Elysia, status } from 'elysia';
import { fetchGithubUser } from '../../../lib/auth-api';
import { deriveAuth, requirePermission } from '../../../lib/guards';

export const githubAvatarGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/github/avatar',
    async ({ auth }) => {
      const user = await fetchGithubUser(env, auth!.userId);
      if (!user) throw status(404, 'github_not_linked');
      const upstream = await fetch(user.avatarUrl);
      if (!upstream.ok) throw status(502, 'github_avatar_unavailable');
      return new Response(upstream.body, {
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream' },
      });
    },
    { beforeHandle: requirePermission('github:avatar.read') }
  );
