import { Elysia, t } from 'elysia';
import { permissionBitmask } from '@Hashibutogarasu/api-permissions';
import { verifyApiKey } from '../lib/auth';

/** Lets other resource servers check a key without each resolving permissions on their own. */
export const apiKeyRoutes = (env: Env) =>
  new Elysia().post(
    '/api-keys/verify',
    async ({ body, set }) => {
      const verified = await verifyApiKey(body.key, env);
      if (!verified) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      return { userId: verified.userId, keyId: verified.keyId, permissions: permissionBitmask.build(verified.permissions).toString() };
    },
    { body: t.Object({ key: t.String({ minLength: 1 }) }) }
  );
