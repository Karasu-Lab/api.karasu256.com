import { Elysia } from 'elysia';
import { z } from 'zod';
import { isInternalCaller } from '../lib/auth';
import { storeProviderAvatar } from '../lib/avatars';

const providerAvatarBodySchema = z.object({ source: z.string().min(1) });

export const avatarRoutes = (env: Env) =>
  new Elysia({ prefix: '/internal/avatars' })
    .onBeforeHandle(({ request, set }) => {
      if (!isInternalCaller(request, env)) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
    })
    .post('/users/:userId/providers/:providerId', async ({ params, body }) => {
      const parsed = providerAvatarBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      return { url: await storeProviderAvatar(env, params.userId, params.providerId, parsed.data.source) };
    });
