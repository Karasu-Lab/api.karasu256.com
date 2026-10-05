import { Elysia } from 'elysia';

/** Callers display what this worker reports about itself instead of inferring it from their own configuration. */
export const metaRoutes = (env: Env) =>
  new Elysia().get('/meta', ({ request }) => ({
    apiUrl: new URL(request.url).origin,
    gitBranch: env.GIT_BRANCH,
  }));
