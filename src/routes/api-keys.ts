import { Elysia } from 'elysia';
import { z } from 'zod';
import { permissionBitmask } from '@karasu-lab/api-permissions';
import { verifyApiKey } from '../lib/auth';

const verifyBodySchema = z.object({ key: z.string().min(1) });

export const apiKeyRoutes = (env: Env) =>
  new Elysia().post('/api-keys/verify', async ({ body, set }) => {
    const parsed = verifyBodySchema.safeParse(body);
    if (!parsed.success) throw parsed.error;
    const verified = await verifyApiKey(parsed.data.key, env);
    if (!verified) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    return { userId: verified.userId, keyId: verified.keyId, permissions: permissionBitmask.build(verified.permissions).toString() };
  });
