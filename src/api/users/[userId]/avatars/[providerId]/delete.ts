import { Elysia } from 'elysia';
import { deleteProviderAvatar } from '../../../../../lib/avatars';
import { requireUserPermission } from '../../../../../lib/guards';

export const userAvatarProviderDelete = (env: Env) =>
  new Elysia().delete(
    '/users/:userId/avatars/:providerId',
    async ({ params }) => {
      await deleteProviderAvatar(env, params.userId, params.providerId);
      return new Response(null, { status: 204 });
    },
    { beforeHandle: requireUserPermission(env, 'users:avatar.delete') }
  );
