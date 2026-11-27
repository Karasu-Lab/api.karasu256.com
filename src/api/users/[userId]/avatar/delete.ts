import { Elysia } from 'elysia';
import { deleteUserAvatar } from '../../../../lib/avatars';
import { requireUserPermission } from '../../../../lib/guards';

export const userAvatarDelete = (env: Env) =>
  new Elysia().delete(
    '/users/:userId/avatar',
    async ({ params }) => {
      await deleteUserAvatar(env, params.userId);
      return new Response(null, { status: 204 });
    },
    { beforeHandle: requireUserPermission(env, 'users:avatar.delete') }
  );
