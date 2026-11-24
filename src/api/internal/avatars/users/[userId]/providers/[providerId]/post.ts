import { Elysia } from 'elysia';
import { z } from 'zod';
import { storeProviderAvatar } from '../../../../../../../lib/avatars';
import { requireInternalCaller } from '../../../../../../../lib/guards';

const providerAvatarBodySchema = z.object({ source: z.string().min(1) });

export const internalAvatarProviderPost = (env: Env) =>
  new Elysia()
    .onBeforeHandle(requireInternalCaller(env))
    .post('/internal/avatars/users/:userId/providers/:providerId', async ({ params, body }) => {
      const parsed = providerAvatarBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      return { url: await storeProviderAvatar(env, params.userId, params.providerId, parsed.data.source) };
    });
