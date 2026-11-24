import { Elysia } from 'elysia';
import { fetchGithubUser } from '../../../lib/auth-api';
import { deriveAuth, requirePermission } from '../../../lib/guards';
import { NotFoundError } from '../../../lib/errors';

export const githubUserGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/github/user',
    async ({ auth }) => {
      const user = await fetchGithubUser(env, auth!.userId);
      if (!user) throw new NotFoundError('github_not_linked');
      return user;
    },
    { beforeHandle: requirePermission('github:user.read') }
  );
