import { Elysia, status } from 'elysia';
import { fetchGithubRepositories } from '../../../lib/auth-api';
import { deriveAuth, requirePermission } from '../../../lib/guards';

export const githubRepositoriesGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/github/repositories',
    async ({ auth }) => {
      const repositories = await fetchGithubRepositories(env, auth!.userId);
      if (!repositories) throw status(404, 'github_not_linked');
      return repositories;
    },
    { beforeHandle: requirePermission('github:repositories.read') }
  );
