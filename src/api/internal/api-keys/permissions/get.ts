import { Elysia } from 'elysia';
import { z } from 'zod';
import { requireInternalCaller } from '../../../../lib/guards';
import { withPermissionService } from '../../../../lib/permission-service';

const grantedPermissionsQuerySchema = z.object({ ids: z.string() });

export const internalApiKeyPermissionsGet = (env: Env) =>
  new Elysia().onBeforeHandle(requireInternalCaller(env)).get('/internal/api-keys/permissions', async ({ query }) => {
    const parsed = grantedPermissionsQuerySchema.safeParse(query);
    if (!parsed.success) throw parsed.error;
    const ids = parsed.data.ids.split(',').filter(Boolean);
    const granted = await withPermissionService(env, (service) => service.getGrantedPermissions(ids));
    return Object.fromEntries(granted);
  });
