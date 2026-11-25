import { Elysia } from 'elysia';
import { z } from 'zod';
import { listOAuthProviders } from '../../../../lib/oauth-providers';

const kindsSchema = z.array(z.enum(['social', 'derived', 'passkey']));

export const apiOauthProvidersGet = (env: Env) =>
  new Elysia().get('/api/oauth/providers', async ({ request, query }) => {
    const kinds = typeof query.kind === 'string' ? kindsSchema.safeParse(query.kind.split(',')) : null;
    return { providers: await listOAuthProviders(env, new URL(request.url).origin, kinds?.success ? kinds.data : undefined) };
  });
