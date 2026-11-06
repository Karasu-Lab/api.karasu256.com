import { Elysia } from 'elysia';
import { z } from 'zod';
import { PermissionService, UnknownPermissionError, toOauthScope } from '@karasu-lab/api-permissions';
import { withDataSource } from '../db/data-source';
import { TypeOrmPermissionRepository } from '../db/typeorm-permission-repository';
import { isInternalCaller } from '../lib/auth';

const grantPermissionsBodySchema = z.object({ permissions: z.array(z.string()) });

const grantedPermissionsQuerySchema = z.object({ ids: z.string() });

function withPermissionService<T>(env: Env, work: (service: PermissionService) => Promise<T>): Promise<T> {
  return withDataSource(env, (dataSource) => work(new PermissionService(new TypeOrmPermissionRepository(dataSource))));
}

export const permissionRoutes = (env: Env) =>
  new Elysia()
    .get('/permissions', () => withPermissionService(env, (service) => service.listActivePermissions()))
    .get('/permissions/scopes', () =>
      withPermissionService(env, async (service) => (await service.listActivePermissions()).map(toOauthScope))
    )
    .get('/:operation/permissions', async ({ params, set }) => {
      const permissions = await withPermissionService(env, (service) => service.listOperationPermissions(params.operation));
      if (permissions.length === 0) {
        set.status = 404;
        return { error: 'unknown_operation' };
      }
      return { operation: params.operation, permissions: permissions.map((permission) => permission.publicId) };
    })
    .group('/internal', (internal) =>
      internal
        .onBeforeHandle(({ request, set }) => {
          if (!isInternalCaller(request, env)) {
            set.status = 401;
            return { error: 'Unauthorized' };
          }
        })
        .put('/api-keys/:id/permissions', async ({ params, body, set }) => {
          const parsed = grantPermissionsBodySchema.safeParse(body);
          if (!parsed.success) throw parsed.error;
          try {
            return await withPermissionService(env, (service) => service.grant(params.id, parsed.data.permissions));
          } catch (err) {
            if (!(err instanceof UnknownPermissionError)) throw err;
            set.status = 400;
            return { error: 'unknown_permission' };
          }
        })
        .get('/api-keys/permissions', async ({ query }) => {
          const parsed = grantedPermissionsQuerySchema.safeParse(query);
          if (!parsed.success) throw parsed.error;
          const ids = parsed.data.ids.split(',').filter(Boolean);
          const granted = await withPermissionService(env, (service) => service.getGrantedPermissions(ids));
          return Object.fromEntries(granted);
        })
    );
