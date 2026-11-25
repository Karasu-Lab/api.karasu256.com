import { Elysia } from 'elysia';
import { listOAuthProviders } from '../../../../lib/oauth-providers';

export const apiOauthProvidersGet = (env: Env) =>
  new Elysia().get('/api/oauth/providers', async ({ request }) => ({
    providers: await listOAuthProviders(env, new URL(request.url).origin),
  }));
