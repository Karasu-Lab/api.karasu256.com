import { Elysia } from 'elysia';
import { z } from 'zod';
import { listOAuthProviders } from '../../../../lib/oauth-providers';

const usageSchema = z.enum(['signIn', 'link']);

export const apiOauthProvidersGet = (env: Env) =>
  new Elysia().get('/api/oauth/providers', async ({ request, query }) => {
    const usage = usageSchema.safeParse(query.usage);
    return { providers: await listOAuthProviders(env, new URL(request.url).origin, usage.success ? usage.data : undefined) };
  });
