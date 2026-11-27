import { Elysia } from 'elysia';
import { deleteProviderAvatar } from '../../../../../../../lib/avatars';
import { requireInternalCaller } from '../../../../../../../lib/guards';

export const internalAvatarProviderDelete = (env: Env) =>
  new Elysia()
    .onBeforeHandle(requireInternalCaller(env))
    .delete('/internal/avatars/users/:userId/providers/:providerId', async ({ params, set }) => {
      await deleteProviderAvatar(env, params.userId, params.providerId);
      set.status = 204;
      return null;
    });
