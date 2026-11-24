import { Elysia, status } from 'elysia';
import { fetchGithubUser } from '../../../lib/auth-api';
import { deriveAuth, requirePermission } from '../../../lib/guards';

export const githubUserGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/github/user',
    async ({ auth }) => {
      const user = await fetchGithubUser(env, auth!.userId);
      if (!user) throw status(404, 'github_not_linked');
      return user;
    },
    { beforeHandle: requirePermission('github:user.read') }
  );
