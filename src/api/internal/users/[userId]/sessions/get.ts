import { Elysia } from 'elysia';
import { z } from 'zod';
import { parseRawJson, requireInternalUser } from '../../../../../lib/guards';
import { listActiveSessions } from '../../../../../lib/sessions';

const sessionsQuerySchema = z.object({ sessionId: z.string().min(1).optional() });

export const internalUserSessionsGet = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .get('/internal/users/:userId/sessions', async ({ params, query }) => {
      const parsed = sessionsQuerySchema.safeParse(query);
      if (!parsed.success) throw parsed.error;
      return listActiveSessions(env, params.userId, parsed.data.sessionId);
    });
