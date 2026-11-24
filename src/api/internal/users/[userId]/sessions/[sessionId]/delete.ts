import { Elysia } from 'elysia';
import { parseRawJson, requireInternalUser } from '../../../../../../lib/guards';
import { revokeActiveSession } from '../../../../../../lib/sessions';
import { NotFoundError } from '../../../../../../lib/errors';

export const internalUserSessionDelete = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .delete('/internal/users/:userId/sessions/:sessionId', async ({ params, set }) => {
      const revoked = await revokeActiveSession(env, params.userId, params.sessionId);
      if (!revoked) throw new NotFoundError('Not found');
      set.status = 204;
      return null;
    });
