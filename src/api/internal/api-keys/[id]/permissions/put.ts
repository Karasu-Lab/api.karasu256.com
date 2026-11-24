import { Elysia } from 'elysia';
import { z } from 'zod';
import { UnknownPermissionError } from '@karasu-lab/api-permissions';
import { requireInternalCaller } from '../../../../../lib/guards';
import { withPermissionService } from '../../../../../lib/permission-service';
import { BadRequestError } from '../../../../../lib/errors';

const grantPermissionsBodySchema = z.object({ permissions: z.array(z.string()) });

export const internalApiKeyPermissionsPut = (env: Env) =>
  new Elysia().onBeforeHandle(requireInternalCaller(env)).put('/internal/api-keys/:id/permissions', async ({ params, body }) => {
    const parsed = grantPermissionsBodySchema.safeParse(body);
    if (!parsed.success) throw parsed.error;
    try {
      return await withPermissionService(env, (service) => service.setGranted(params.id, parsed.data.permissions));
    } catch (err) {
      if (!(err instanceof UnknownPermissionError)) throw err;
      throw new BadRequestError('unknown_permission');
    }
  });
