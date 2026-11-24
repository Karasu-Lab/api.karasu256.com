import { Elysia } from 'elysia';
import { withPermissionService } from '../../lib/permission-service';

export const permissionsGet = (env: Env) =>
  new Elysia().get('/permissions', () => withPermissionService(env, (service) => service.listActivePermissions()));
