import { Elysia } from 'elysia';
import { z } from 'zod';
import { storeUserAvatar } from '../../../../lib/avatars';
import { requireUserPermission } from '../../../../lib/guards';

const userAvatarBodySchema = z.object({ source: z.string().min(1) });

export const userAvatarPost = (env: Env) =>
  new Elysia().post(
    '/users/:userId/avatar',
    async ({ params, body }) => {
      const parsed = userAvatarBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      return { url: await storeUserAvatar(env, params.userId, parsed.data.source) };
    },
    { beforeHandle: requireUserPermission(env, 'users:profile.write') }
  );
