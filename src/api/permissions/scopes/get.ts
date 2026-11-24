import { Elysia } from 'elysia';
import { toOauthScope } from '@karasu-lab/api-permissions';
import { withPermissionService } from '../../../lib/permission-service';

export const permissionScopesGet = (env: Env) =>
  new Elysia().get('/permissions/scopes', () =>
    withPermissionService(env, async (service) => (await service.listActivePermissions()).map(toOauthScope))
  );
