import { Elysia } from 'elysia';
import { fetchGithubUser } from '../../../lib/auth-api';
import { deriveAuth, requirePermission } from '../../../lib/guards';
import { BadGatewayError, NotFoundError } from '../../../lib/errors';

export const githubAvatarGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/github/avatar',
    async ({ auth }) => {
      const user = await fetchGithubUser(env, auth!.userId);
      if (!user) throw new NotFoundError('github_not_linked');
      const upstream = await fetch(user.avatarUrl);
      if (!upstream.ok) throw new BadGatewayError('github_avatar_unavailable');
      return new Response(upstream.body, {
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream' },
      });
    },
    { beforeHandle: requirePermission('github:avatar.read') }
  );
