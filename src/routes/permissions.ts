import { Elysia, t } from 'elysia';
import { ALL_PERMISSIONS, PermissionService, UnknownPermissionError, toOauthScope } from '@Hashibutogarasu/api-permissions';
import { withDataSource } from '../db/data-source';
import { TypeOrmPermissionRepository } from '../db/typeorm-permission-repository';
import { isInternalCaller } from '../lib/auth';

const AVAILABLE_SCOPES = ALL_PERMISSIONS.map(toOauthScope);

function withPermissionService<T>(env: Env, work: (service: PermissionService) => Promise<T>): Promise<T> {
  return withDataSource(env, (dataSource) => work(new PermissionService(new TypeOrmPermissionRepository(dataSource))));
}

export const permissionRoutes = (env: Env) =>
  new Elysia()
    .get('/permissions', () => withPermissionService(env, (service) => service.listActivePermissions()))
    .get('/permissions/scopes', () => AVAILABLE_SCOPES)
    .group('/internal', (internal) =>
      internal
        .onBeforeHandle(({ request, set }) => {
          if (!isInternalCaller(request, env)) {
            set.status = 401;
            return { error: 'Unauthorized' };
          }
        })
        .put(
          '/api-keys/:id/permissions',
          async ({ params, body, set }) => {
            try {
              return await withPermissionService(env, (service) => service.grant(params.id, body.permissions));
            } catch (err) {
              if (!(err instanceof UnknownPermissionError)) throw err;
              set.status = 400;
              return { error: 'unknown_permission' };
            }
          },
          { body: t.Object({ permissions: t.Array(t.String()) }) }
        )
        .get(
          '/api-keys/permissions',
          async ({ query }) => {
            const ids = query.ids.split(',').filter(Boolean);
            const granted = await withPermissionService(env, (service) => service.getGrantedPermissions(ids));
            return Object.fromEntries(granted);
          },
          { query: t.Object({ ids: t.String() }) }
        )
    );
