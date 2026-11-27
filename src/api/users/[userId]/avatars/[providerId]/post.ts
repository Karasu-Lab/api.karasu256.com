import { Elysia } from 'elysia';
import { z } from 'zod';
import { storeProviderAvatar } from '../../../../../lib/avatars';
import { requireUserPermission } from '../../../../../lib/guards';

const providerAvatarBodySchema = z.object({ source: z.string().min(1) });

export const userAvatarProviderPost = (env: Env) =>
  new Elysia().post(
    '/users/:userId/avatars/:providerId',
    async ({ params, body }) => {
      const parsed = providerAvatarBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      return { url: await storeProviderAvatar(env, params.userId, params.providerId, parsed.data.source) };
    },
    { beforeHandle: requireUserPermission(env, 'users:profile.write') }
  );
